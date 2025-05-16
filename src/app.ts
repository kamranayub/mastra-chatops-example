import bolt from "@slack/bolt";
import "dotenv/config";
import { mastra } from "./mastra/index.ts";
import type { CoreMessage } from "@mastra/core";
import type { GenerateTextResult, ToolResult } from "ai";

// Initializes your app with your bot token and signing secret
const app = new bolt.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  // Socket Mode doesn't listen on a port, but in case you want your app to respond to OAuth,
  // you still need to listen on some port!
  port: parseInt(process.env.PORT || "3000", 10),
});

const assistant = new bolt.Assistant({
  /**
   * `assistant_thread_started` is sent when a user opens the Assistant container.
   * This can happen via DM with the app or as a side-container within a channel.
   * https://api.slack.com/events/assistant_thread_started
   */
  threadStarted: async ({
    event,
    say,
    logger,
    setSuggestedPrompts,
    saveThreadContext,
  }) => {
    const { context } = event.assistant_thread;

    try {
      // Since context is not sent along with individual user messages, it's necessary to keep
      // track of the context of the conversation to better assist the user. Sending an initial
      // message to the user with context metadata facilitates this, and allows us to update it
      // whenever the user changes context (via the `assistant_thread_context_changed` event).
      // The `say` utility sends this metadata along automatically behind the scenes.
      // !! Please note: this is only intended for development and demonstrative purposes.
      await say("Hi, how can I help?");

      await saveThreadContext();

      const prompts = [
        {
          title: "Restart DB",
          message: "Reboot the database server.",
        },
        {
          title: "Look up user",
          message: "Look up the user `username` in the database",
        },
      ];

      // If the user opens the Assistant container in a channel, additional
      // context is available.This can be used to provide conditional prompts
      // that only make sense to appear in that context (like summarizing a channel).
      if (context.channel_id) {
        prompts.push({
          title: "Summarize channel",
          message: "Assistant, please summarize the activity in this channel!",
        });
      }

      // Provide the user up to 4 optional, preset prompts to choose from.
      await setSuggestedPrompts({
        // @ts-ignore
        prompts,
        title: "Here are some suggested options:",
      });
    } catch (error) {
      logger.error(error);
    }
  },

  /**
   * Messages sent to the Assistant do not contain a subtype and must
   * be deduced based on their shape and metadata (if provided).
   * https://api.slack.com/events/message
   */
  userMessage: async ({
    client,
    logger,
    message,
    getThreadContext,
    say,
    setTitle,
    setStatus,
  }) => {
    if (!('thread_ts' in message) || !message.thread_ts) return;
    if (!message.text) return;

    const { channel, thread_ts } = message;

    try {
      /**
       * Set the title of the Assistant thread to capture the initial topic/question
       * as a way to facilitate future reference by the user.
       * https://api.slack.com/methods/assistant.threads.setTitle
       */
      await setTitle(message.text);

      /**
       * Set the status of the Assistant to give the appearance of active processing.
       * https://api.slack.com/methods/assistant.threads.setStatus
       */
      await setStatus("is typing...");

      const ktomgAgent = mastra.getAgent("ktomgAgent");
      const agentResponse = await ktomgAgent.generate(message.text, { 
        threadId: channel, /* default: Channel-scoped memory. Use `thread_ts` for conversation-scoped memory */
        resourceId: message.user ?? 'default', 
        maxSteps: 3 
      });
      const slackResponse = formatAgentSlackResponse(agentResponse);

      await say(slackResponse);
    } catch (e) {
      logger.error(e);

      // Send message to advise user and clear processing status if a failure occurs
      await say({ text: "Sorry, something went wrong!" });
    }
  },
});

app.assistant(assistant);

app.action({ action_id: "resume-workflow", block_id: "workflow-suspended" }, async ({ action, ack, respond }) => {
  await ack();

  const runParams = action.type === "button" ? action.value : undefined;

  if (!runParams) {
    await respond(`Looks like I can skip the workflow.`);
    return;
  }

  console.log(`Resuming workflow with params:`, runParams);

  const runArgs = new URLSearchParams(runParams);
  // @ts-ignore
  const workflow = mastra.getWorkflow(runArgs.get("workflow")!);
  
  if (!workflow) {
    await respond(`Looks like the workflow [${runArgs.get("workflow")}] doesn't exist.`);
    return;
  }

  const workflowContext: Record<string, string> = {};

  for (const [key, value] of runArgs.entries()) {
    if (!key.startsWith("context.")) continue;
    const path = key.split(".");
    workflowContext[path[1]] = value;
  }

  console.log(`Resuming workflow [${workflow.name}] run [${runArgs.get("runId")}] at step [${runArgs.get("stepId")}] with context:`, workflowContext);
  const run = workflow.createRun({ runId: runArgs.get("runId")! });

  if (!run) {
    await respond(`Looks like the workflow [${workflow.name}] run [${runArgs.get("runId")}] doesn't exist.`);
    return;
  }

  const resumeResult = await run.resume({
    stepId: runArgs.get("stepId")!,
    context: workflowContext
  });

  console.log(`Workflow [${workflow.name}] resumed with result:`, resumeResult?.results);

  const messages = [
    'Interpret the results of this workflow step and provide a response to the user: ' +
    JSON.stringify(resumeResult)
  ];

  const ktomgAgent = mastra.getAgent("ktomgAgent");
  const agentResponse = await ktomgAgent.generate(messages, {
    threadId: runArgs.get("threadId")!,
    resourceId: runArgs.get("resourceId")!,
    maxSteps: 1
  });

  await respond(formatAgentSlackResponse(agentResponse));
});

/** Start the Bolt App */
(async () => {
  try {
    await app.start();
    app.logger.info('⚡️ Bolt app is running!');
  } catch (error) {
    app.logger.error('Failed to start the app', error);
  }
})();

function formatAgentSlackResponse(agentResponse: GenerateTextResult<any, any>) {
  let finalSay;
  const toolResults = getToolResults(agentResponse);

  if (toolResults.length) {
    for (const toolResult of toolResults) {
      if (typeof toolResult.result.message === 'string') {
        finalSay = { text: `[${toolResult.toolName}] ${toolResult.result.message}` };
      } else if (typeof toolResult.result.message === 'object') {
        finalSay = toolResult.result.message;
      }
    }
  }

  if (!finalSay) {
    finalSay = { text: agentResponse.text || "Sorry, I couldn't find an answer to that." };
  }

  return finalSay;
}

function getToolResults(agentResponse: GenerateTextResult<any, any>): ToolResult<any, any, any>[] {
  const toolResults: ToolResult<any, any, any>[] = [];
  
  for (const toolResult of agentResponse.toolResults) {
    toolResults.push(toolResult);
  }

  for(const step of agentResponse.steps) {
    for (const toolResult of step.toolResults) {
      toolResults.push(toolResult);
    }
  }

  return toolResults;
}
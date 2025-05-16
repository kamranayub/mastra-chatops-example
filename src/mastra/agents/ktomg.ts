import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { listVmsTool, restartVmTool } from "../tools/vm-tools.ts";

export const ktomgAgent = new Agent({
  name: "KTOMG Ops Agent",
  instructions: `You're an assistant in a Slack workspace with the ability to automatically recall memories from previous interactions.
  Users in the workspace will ask you to help them perform DevOps tasks.
  For managing virtual machines, they each have an ID and associated label. You may use the List VMs tool to find the ID if the user only provides a label, or you must prompt them to name the VM if they don't already.
  Once you have a VM ID, you can then restart it using the restart VM tool workflow.
  When you include markdown text, convert them to Slack compatible ones.
  When a prompt has Slack's special syntax like <@USER_ID> or <#CHANNEL_ID>, you must keep them as-is in your response.`,
  model: openai("gpt-4o-mini"),
  tools: { restartVmTool, listVmsTool },
  memory: new Memory({
    options: {
      lastMessages: 40,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
    },
  })
});
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { vultr } from "../../vultr.ts";

export const restartVmTool = createTool({
  id: "restart-vm",
  description: "Restart a virtual machine (VM) by ID.",
  inputSchema: z.object({
    vmId: z.string().describe("Virtual machine ID)"),
    vmLabel: z.string().describe("Virtual machine label"),
  }),
  outputSchema: z.object({
    message: z.string().or(z.object({ blocks: z.any() })),
    restarted: z.boolean(),
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    const restartFlow = mastra?.getWorkflow("restartVmWorkflow");

    if (!restartFlow) {
      return {
        message: "Workflow to restart a VM was not found",
        restarted: false,
      };
    }

    const { runId, start } = restartFlow.createRun();
    const initialResult = await start({
      triggerData: {
        vmId: context.vmId,
        vmLabel: context.vmLabel
      },
    });

    console.log(`Restart VM workflow started with run ID: ${runId}`);

    const reviewStepResult = initialResult.activePaths.get("review-vm");

    if (reviewStepResult?.status === "suspended") {
      console.log(
        `Restart VM workflow suspended at review step with payload:`,
        reviewStepResult.suspendPayload
      );

      return {
        message: {
          blocks: [
            {
              block_id: "workflow-suspended",
              type: "section",
              text: {
                type: "mrkdwn",
                text: reviewStepResult.suspendPayload.message,
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Approve",
                  emoji: true,
                },
                value: new URLSearchParams({ 
                  runId, 
                  workflow: "restartVmWorkflow", 
                  stepId: "review-vm",
                  threadId: threadId ?? '',
                  resourceId: resourceId ?? '',
                  'context.approvedVmId': context.vmId
                }).toString(),
                action_id: "resume-workflow",
              },
            },
          ],
        },
        restarted: false,
      };
    }

    console.log(
      "Restart VM workflow completed with result:",
      initialResult.result
    );

    return {
      message: initialResult.result?.restarted
        ? `VM with ID ${context.vmId ?? "(blank)"} restarted successfully.`
        : `Failed to restart VM with ID ${context.vmId ?? "(blank)"}.`,
      restarted: initialResult.result?.restarted ?? false,
    };
  },
});

export const listVmsTool = createTool({
  id: "list-vms",
  description: "List all virtual machine (VM) in the account",
  outputSchema: z.array(
    z.object({
      id: z.string().describe("Virtual machine ID"),
      label: z.string().describe("Virtual machine label"),
      power_status: z
        .string()
        .describe("Virtual machine power status (running, stopped)"),
      server_status: z
        .string()
        .describe(
          "Virtual machine server status (ok, none, locked, installing, booting"
        ),
      status: z
        .string()
        .describe("Virtual machine status (active, pending, suspended)"),
      tags: z
        .array(z.string())
        .describe("Tags associated with the virtual machine"),
    })
  ),
  execute: async () => {
    console.log("Listing VMs...");

    try {
      const response = await vultr.instances.listInstances({});

      console.log(`Response from VM list:`, response);

      if (!response.instances) {
        throw new Error(`Failed to list VMs`);
      }
      return response.instances;
    } catch (error) {
      throw error;
    }
  },
});

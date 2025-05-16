import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { vultr } from "../../vultr.ts";

export const restartVmWorkflow = new Workflow({
    name: "restart-vm",
    triggerSchema: z.object({
        vmId: z.string().describe("Virtual machine ID"),
        vmLabel: z.string().describe("Virtual machine label"),
    })
});

const reviewVm = new Step({
    id: 'review-vm',
    inputSchema: z.object({
        approvedVmId: z.string().optional().describe("Approved virtual machine ID"),
    }),
    outputSchema: z.object({
        finalVmId: z.string().describe("The final approved virtual machine ID"),
    }),
    execute: async ({ context, suspend }) => {
        const { vmId, vmLabel } = context.triggerData;

        if (!context.inputData?.approvedVmId) {
            await suspend({
                vmId,
                message: `Please confirm if you want to restart the VM with the label: ${vmLabel} (ID: ${vmId}).`,
            });

            return {
                finalVmId: ''
            };
        }

        return {
            finalVmId: context.inputData.approvedVmId,
        };
    }
});

const restartVm = new Step({
  id: "restart-vm",
  description: "Restart a virtual machine (VM) by ID.",
  inputSchema: z.object({
    vmId: z.string().describe("Virtual machine ID)"),
  }),
  outputSchema: z.object({
    restarted: z.boolean(),
  }),
  execute: async ({ context }) => {
    console.log(`Restarting VM with ID: ${context.triggerData.vmId}`);

    if (!context.triggerData.vmId) {
      throw new Error("VM ID is required to restart the VM.");
    }

    try {
      const response = await vultr.instances.rebootInstance({
        "instance-id": context.triggerData.vmId,
      });

      console.log(`Response from VM restart:`, response);

      return { restarted: true };
    } catch (error) {
      throw error;
    }
  },
});

restartVmWorkflow
    .step(reviewVm)
    .then(restartVm, {
        variables: {
            vmId: { step: reviewVm, path: "finalVmId" },
        }
    })
    .commit();
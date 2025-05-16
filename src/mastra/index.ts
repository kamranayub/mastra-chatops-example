import { Mastra } from "@mastra/core";
 
import { restartVmWorkflow } from "./workflows/restart-vm-workflow.ts";
import { ktomgAgent } from "./agents/ktomg.ts";
 
export const mastra = new Mastra({
  agents: { 
    ktomgAgent 
  },
  workflows: { 
    restartVmWorkflow 
  }
});
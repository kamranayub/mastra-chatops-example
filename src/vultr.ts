import Vultr from "@vultr/vultr-node";

export const vultr = Vultr.initialize({
  apiKey: process.env.VULTR_API_KEY,
  rateLimit: 600, // Optional
});

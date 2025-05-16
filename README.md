# Mastra Example ChatOps (WIP)

An example of building a Slack-based ChatOps agent with Mastra:

- Has working memory
- Hooked up to Slack
- Can restart virtual machines with Vultr tool
- Showcases Human-in-the-Loop approvals with Slack BlockKit UI

## Video

I explain the architecture and what I've done so far here:

https://youtu.be/ziUOmhcVXsw

## To Run It

1. You'll need some [Slack API keys and an app all hooked up properly](https://tools.slack.dev/bolt-js/getting-started/)
2. You'll need a [Vultr](https://vultr.com) account and API key
3. You'll need [OpenAI developer keys](https://platform.openai.com)

Then:

```sh
bun install # or npm install
bun start # start Slack Bolt server
bun run dev # starts Mastra dev studio
```

> [!NOTE]
> The demo files are what I'm using in real-life, so it's not really meant to be run but you certainly can try 😄 There's nothing product-specific here (yet).

The way the app is written here is not meant to be hosted outside the local machine. I'm working on a Slack Bolt receiver that integrates with Mastra's Hono server using custom API endpoints. Once I have that figured out, it should be able to be hosted on Mastra Cloud or another provider for production use.

Example ChatGPT convo (it's not exactly accurate but gives something to start from): https://chatgpt.com/share/682748f3-dd80-800a-a705-c674a351439e

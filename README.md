# Mastra Example ChatOps (WIP)

An example of building a Slack-based ChatOps agent with Mastra:

- Has working memory
- Hooked up to Slack
- Can restart virtual machines with Vultr tool

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
bun start
```

> [!NOTE}
> It uses Slack "Socket Mode" in development.

The demo files are what I'm using in real-life, so it's not really meant to be run but you certainly can try 😄 There's nothing product-specific here (yet).

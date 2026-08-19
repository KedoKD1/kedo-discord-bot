const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is online")
].map(command => command.toJSON());

console.log("🔑 Token loaded:", !!process.env.DISCORD_TOKEN);

client.once("clientReady", async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Failed to register commands:", error.message);
  }
});

client.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error("❌ Discord login failed:", error.message);
    process.exit(1);
  });

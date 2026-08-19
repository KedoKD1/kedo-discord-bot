const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

console.log("🔑 Token loaded:", !!token);

if (!token) {
  console.error("❌ DISCORD_TOKEN is missing!");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is online")
].map(command => command.toJSON());

client.once("clientReady", async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Command registration failed:", error.message);
  }
});

// استقبال الأوامر
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong! 🏓");
  }
});

console.log("🔄 Connecting to Discord...");

client.login(token)
  .then(() => {
    console.log("🔐 Discord login successful!");
  })
  .catch(error => {
    console.error("❌ Discord login failed:", error.message);
    process.exit(1);
  });

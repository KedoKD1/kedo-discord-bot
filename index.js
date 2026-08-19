const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ DISCORD_TOKEN is missing!");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ====================
// Slash Commands
// ====================

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show the bot's system status"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available bot commands")
].map(command => command.toJSON());

// ====================
// Uptime
// ====================

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

// ====================
// Bot Ready
// ====================

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
    console.error(
      "❌ Command registration failed:",
      error.message
    );
  }
});

// ====================
// Interactions
// ====================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ====================
  // /ping
  // ====================

  if (interaction.commandName === "ping") {
    const ping = Math.round(client.ws.ping);

    const servers = client.guilds.cache.size;

    const users = client.guilds.cache.reduce(
      (total, guild) => total + guild.memberCount,
      0
    );

    const uptime = formatUptime(
      Math.floor(process.uptime())
    );

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("🟢 KDBot Status")
      .setDescription("**🟢 Online**")
      .addFields(
        {
          name: "🏓 Ping",
          value: `\`${ping}ms\``,
          inline: true
        },
        {
          name: "💻 Servers",
          value: `\`${servers}\``,
          inline: true
        },
        {
          name: "👥 Users",
          value: `\`${users.toLocaleString()}\``,
          inline: true
        },
        {
          name: "⏱️ Uptime",
          value: `\`${uptime}\``,
          inline: true
        },
        {
          name: "📡 API Status",
          value: "`Online`",
          inline: true
        },
        {
          name: "⚙️ Version",
          value: "`v1.0.0`",
          inline: true
        }
      )
      .setFooter({
        text: "KDBot • System Status"
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }

  // ====================
  // /help
  // ====================

  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📖 KDBot Help")
      .setDescription(
        "مرحباً بك في **KDBot**!\n\n" +
        "هذه قائمة الأوامر المتوفرة حاليًا:"
      )
      .addFields(
        {
          name: "ℹ️ Information",
          value:
            "`/ping` — فحص حالة البوت ومعلومات النظام\n" +
            "`/help` — عرض قائمة الأوامر",
          inline: false
        }
      )
      .setFooter({
        text: "KDBot • Help Menu"
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
});

// ====================
// Login
// ====================

client.login(token)
  .then(() => {
    console.log("🔐 Discord login successful!");
  })
  .catch(error => {
    console.error(
      "❌ Discord login failed:",
      error.message
    );

    process.exit(1);
  });

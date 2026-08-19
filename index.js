const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
// Commands
// ====================

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show the bot's system status"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open the KDBot help center")
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
// Help Menu
// ====================

function createHelpEmbed(section = "home") {

  if (section === "home") {
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("✨ KDBot • Help Center")
      .setDescription(
        "مرحباً بك في **KDBot**!\n\n" +
        "اختر القسم الذي تريد استعراض أوامره من الأزرار بالأسفل."
      )
      .addFields(
        {
          name: "📊 Information",
          value: "معلومات وفحص حالة البوت",
          inline: true
        },
        {
          name: "🛠️ Management",
          value: "أوامر إدارة السيرفر",
          inline: true
        },
        {
          name: "🎮 Fun",
          value: "أوامر الترفيه",
          inline: true
        },
        {
          name: "⚙️ Settings",
          value: "إعدادات البوت",
          inline: true
        }
      )
      .setFooter({
        text: "KDBot • Help Center"
      })
      .setTimestamp();
  }

  if (section === "info") {
    return new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle("📊 Information")
      .setDescription("أوامر المعلومات والفحص")
      .addFields({
        name: "🏓 `/ping`",
        value: "عرض حالة البوت وسرعة الاتصال وعدد السيرفرات والمستخدمين.",
        inline: false
      })
      .setFooter({
        text: "KDBot • Information"
      });
  }

  if (section === "management") {
    return new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("🛠️ Management")
      .setDescription(
        "أوامر إدارة السيرفر\n\n" +
        "🚧 **قريباً**\n" +
        "سيتم إضافة أوامر الإدارة هنا."
      )
      .setFooter({
        text: "KDBot • Management"
      });
  }

  if (section === "fun") {
    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle("🎮 Fun")
      .setDescription(
        "أوامر الترفيه\n\n" +
        "🚧 **قريباً**\n" +
        "سيتم إضافة أوامر الترفيه هنا."
      )
      .setFooter({
        text: "KDBot • Fun"
      });
  }

  if (section === "settings") {
    return new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("⚙️ Settings")
      .setDescription(
        "إعدادات البوت\n\n" +
        "🚧 **قريباً**\n" +
        "سيتم إضافة إعدادات البوت هنا."
      )
      .setFooter({
        text: "KDBot • Settings"
      });
  }
}

// ====================
// Buttons
// ====================

function createHelpButtons() {
  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("help_home")
      .setLabel("Home")
      .setEmoji("🏠")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("help_info")
      .setLabel("Information")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_management")
      .setLabel("Management")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_fun")
      .setLabel("Fun")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_settings")
      .setLabel("Settings")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary)

  );
}

// ====================
// Ready
// ====================

client.once("clientReady", async () => {

  console.log(`✅ Bot online as ${client.user.tag}`);

  try {

    const rest = new REST({
      version: "10"
    }).setToken(token);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
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

  // Slash Commands
  if (interaction.isChatInputCommand()) {

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

      await interaction.reply({
        embeds: [
          createHelpEmbed("home")
        ],
        components: [
          createHelpButtons()
        ]
      });

    }

  }

  // ====================
  // Help Buttons
  // ====================

  if (interaction.isButton()) {

    const id = interaction.customId;

    const sectionMap = {
      help_home: "home",
      help_info: "info",
      help_management: "management",
      help_fun: "fun",
      help_settings: "settings"
    };

    const section = sectionMap[id];

    if (!section) return;

    await interaction.update({
      embeds: [
        createHelpEmbed(section)
      ],
      components: [
        createHelpButtons()
      ]
    });

  }

});

// ====================
// Login
// ====================

client.login(token)
  .then(() => {

    console.log(
      "🔐 Discord login successful!"
    );

  })
  .catch(error => {

    console.error(
      "❌ Discord login failed:",
      error.message
    );

    process.exit(1);

  });

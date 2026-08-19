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
// Language
// ====================

function getLanguage(interaction) {
  const locale = interaction.locale || "en-US";

  return locale.toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
}

// ====================
// Uptime
// ====================

function formatUptime(seconds, language) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  if (language === "ar") {
    const parts = [];

    if (days) parts.push(`${days} يوم`);
    if (hours) parts.push(`${hours} ساعة`);
    if (minutes) parts.push(`${minutes} دقيقة`);
    if (seconds || parts.length === 0) {
      parts.push(`${seconds} ثانية`);
    }

    return parts.join(" و ");
  }

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

// ====================
// Help Embed
// ====================

function createHelpEmbed(section, language) {

  if (language === "ar") {

    if (section === "home") {
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("✨ KDBot • مركز المساعدة")
        .setDescription(
          "مرحباً بك في **KDBot**!\n\n" +
          "اختر القسم الذي تريد استعراض أوامره من الأزرار بالأسفل."
        )
        .addFields(
          {
            name: "📊 المعلومات",
            value: "معلومات وفحص حالة البوت",
            inline: true
          },
          {
            name: "🛠️ الإدارة",
            value: "أوامر إدارة السيرفر",
            inline: true
          },
          {
            name: "🎮 الترفيه",
            value: "أوامر الترفيه",
            inline: true
          },
          {
            name: "⚙️ الإعدادات",
            value: "إعدادات البوت",
            inline: true
          }
        )
        .setFooter({
          text: "KDBot • مركز المساعدة"
        })
        .setTimestamp();
    }

    if (section === "info") {
      return new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📊 المعلومات")
        .setDescription("أوامر المعلومات وفحص حالة البوت")
        .addFields({
          name: "🏓 `/ping`",
          value:
            "عرض حالة البوت وسرعة الاتصال وعدد السيرفرات والمستخدمين ومدة التشغيل.",
          inline: false
        })
        .setFooter({
          text: "KDBot • المعلومات"
        });
    }

    if (section === "management") {
      return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("🛠️ الإدارة")
        .setDescription(
          "أوامر إدارة السيرفر\n\n" +
          "🚧 **قريباً**\n" +
          "سيتم إضافة أوامر الإدارة هنا."
        )
        .setFooter({
          text: "KDBot • الإدارة"
        });
    }

    if (section === "fun") {
      return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🎮 الترفيه")
        .setDescription(
          "أوامر الترفيه\n\n" +
          "🚧 **قريباً**\n" +
          "سيتم إضافة أوامر الترفيه هنا."
        )
        .setFooter({
          text: "KDBot • الترفيه"
        });
    }

    if (section === "settings") {
      return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("⚙️ الإعدادات")
        .setDescription(
          "إعدادات البوت\n\n" +
          "🚧 **قريباً**\n" +
          "سيتم إضافة إعدادات البوت هنا."
        )
        .setFooter({
          text: "KDBot • الإعدادات"
        });
    }

  } else {

    if (section === "home") {
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("✨ KDBot • Help Center")
        .setDescription(
          "Welcome to **KDBot**!\n\n" +
          "Choose a category below to explore its commands."
        )
        .addFields(
          {
            name: "📊 Information",
            value: "Bot information and status",
            inline: true
          },
          {
            name: "🛠️ Management",
            value: "Server management commands",
            inline: true
          },
          {
            name: "🎮 Fun",
            value: "Fun and entertainment commands",
            inline: true
          },
          {
            name: "⚙️ Settings",
            value: "Bot settings",
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
        .setDescription("Information and bot status commands")
        .addFields({
          name: "🏓 `/ping`",
          value:
            "Show the bot status, latency, servers, users and uptime.",
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
          "Server management commands\n\n" +
          "🚧 **Coming Soon**\n" +
          "Management commands will be added here."
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
          "Fun and entertainment commands\n\n" +
          "🚧 **Coming Soon**\n" +
          "Fun commands will be added here."
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
          "Bot settings\n\n" +
          "🚧 **Coming Soon**\n" +
          "Settings will be added here."
        )
        .setFooter({
          text: "KDBot • Settings"
        });
    }
  }
}

// ====================
// Help Buttons
// ====================

function createHelpButtons(language) {

  if (language === "ar") {

    return new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("help_home")
        .setLabel("الرئيسية")
        .setEmoji("🏠")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("help_info")
        .setLabel("المعلومات")
        .setEmoji("📊")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("help_management")
        .setLabel("الإدارة")
        .setEmoji("🛠️")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("help_fun")
        .setLabel("الترفيه")
        .setEmoji("🎮")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("help_settings")
        .setLabel("الإعدادات")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Secondary)
    );

  }

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

  // ====================
  // Slash Commands
  // ====================

  if (interaction.isChatInputCommand()) {

    const language = getLanguage(interaction);

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
        Math.floor(process.uptime()),
        language
      );

      const embed = new EmbedBuilder();

      if (language === "ar") {

        embed
          .setColor(0x57F287)
          .setTitle("🟢 حالة KDBot")
          .setDescription("**🟢 متصل**")
          .addFields(
            {
              name: "🏓 سرعة الاستجابة",
              value: `\`${ping}ms\``,
              inline: true
            },
            {
              name: "💻 السيرفرات",
              value: `\`${servers}\``,
              inline: true
            },
            {
              name: "👥 المستخدمون",
              value: `\`${users.toLocaleString()}\``,
              inline: true
            },
            {
              name: "⏱️ مدة التشغيل",
              value: `\`${uptime}\``,
              inline: true
            },
            {
              name: "📡 حالة Discord",
              value: "`متصل`",
              inline: true
            },
            {
              name: "⚙️ الإصدار",
              value: "`v1.0.0`",
              inline: true
            }
          )
          .setFooter({
            text: "KDBot • حالة النظام"
          })
          .setTimestamp();

      } else {

        embed
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
      }

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
          createHelpEmbed("home", language)
        ],
        components: [
          createHelpButtons(language)
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

    // اللغة الخاصة بالشخص الذي ضغط الزر
    const language = getLanguage(interaction);

    // صاحب أمر /help الأصلي
    const ownerId = interaction.message.interaction?.user?.id;

    // منع أي شخص آخر من استخدام الأزرار
    if (ownerId && interaction.user.id !== ownerId) {

      if (language === "ar") {

        await interaction.reply({
          content:
            "⚠️ هذه القائمة ليست لك.\n" +
            "استخدم `/help` لفتح قائمة المساعدة الخاصة بك.",
          ephemeral: true
        });

      } else {

        await interaction.reply({
          content:
            "⚠️ This menu isn't yours.\n" +
            "Use `/help` to open your own help menu.",
          ephemeral: true
        });

      }

      return;
    }

    await interaction.update({
      embeds: [
        createHelpEmbed(section, language)
      ],
      components: [
        createHelpButtons(language)
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

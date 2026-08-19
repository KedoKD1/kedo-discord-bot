const { createClient } = require("@supabase/supabase-js");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require("discord.js");

// ==================================================
// ENVIRONMENT
// ==================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase environment variables are missing!");
  process.exit(1);
}

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing!");
  process.exit(1);
}

// ==================================================
// SUPABASE
// ==================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log("Supabase URL exists:", !!SUPABASE_URL);
console.log("Supabase Key exists:", !!SUPABASE_KEY);
console.log("🚀 Starting Discord login...");

// ==================================================
// DISCORD
// ==================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ==================================================
// CACHE
// ==================================================

const userLanguages = new Map();
const guildLanguages = new Map();
const tempBanTimers = new Map();

// ==================================================
// LANGUAGE
// ==================================================

async function getLanguage(interaction) {

  const userId = interaction.user.id;

  if (userLanguages.has(userId)) {
    return userLanguages.get(userId);
  }

  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("discord_id", userId)
    .limit(1);

  if (!error && data && data.length > 0) {

    const language =
      data[0].language === "en"
        ? "en"
        : "ar";

    userLanguages.set(userId, language);

    return language;
  }

  let language = "en";

  if (interaction.locale) {
    language =
      interaction.locale
        .toLowerCase()
        .startsWith("ar")
        ? "ar"
        : "en";
  }

  userLanguages.set(userId, language);

  await saveUser(interaction, language);

  return language;
}

// ==================================================
// SAVE USER
// ==================================================

async function saveUser(interaction, language) {

  const discordId = interaction.user.id;
  const username = interaction.user.username;

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("discord_id", discordId)
    .limit(1);

  if (error) {
    console.log("❌ User lookup:", error.message);
    return;
  }

  if (data && data.length > 0) {

    const { error: updateError } =
      await supabase
        .from("users")
        .update({
          username,
          language
        })
        .eq("discord_id", discordId);

    if (updateError) {
      console.log(
        "❌ User update:",
        updateError.message
      );
    }

  } else {

    const { error: insertError } =
      await supabase
        .from("users")
        .insert({
          discord_id: discordId,
          username,
          language
        });

    if (insertError) {
      console.log(
        "❌ User insert:",
        insertError.message
      );
    }
  }
}

// ==================================================
// SAVE GUILD
// ==================================================

async function saveGuild(guild, language = "ar") {

  if (!guild) return;

  const { data, error } = await supabase
    .from("guilds")
    .select("id")
    .eq("guild_id", guild.id)
    .limit(1);

  if (error) {
    console.log(
      "❌ Guild lookup:",
      error.message
    );
    return;
  }

  if (data && data.length > 0) {

    await supabase
      .from("guilds")
      .update({
        language
      })
      .eq("guild_id", guild.id);

  } else {

    const { error: insertError } =
      await supabase
        .from("guilds")
        .insert({
          guild_id: guild.id,
          language
        });

    if (insertError) {
      console.log(
        "❌ Guild insert:",
        insertError.message
      );
    }
  }

  guildLanguages.set(
    guild.id,
    language
  );
}

// ==================================================
// UPTIME
// ==================================================

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

  if (seconds || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

// ==================================================
// TIME
// ==================================================

function convertTime(amount, unit) {

  const units = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };

  return amount * units[unit];
}

function unitChoices() {

  return [
    {
      name: "Seconds",
      value: "seconds"
    },
    {
      name: "Minutes",
      value: "minutes"
    },
    {
      name: "Hours",
      value: "hours"
    },
    {
      name: "Days",
      value: "days"
    }
  ];
}

// ==================================================
// COMMANDS
// ==================================================

const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show bot status"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open KDBot help center"),

  new SlashCommandBuilder()
    .setName("language")
    .setDescription("Choose your language")
    .addStringOption(option =>
      option
        .setName("language")
        .setDescription("Choose a language")
        .setRequired(true)
        .addChoices(
          {
            name: "🇮🇶 العربية",
            value: "ar"
          },
          {
            name: "🇬🇧 English",
            value: "en"
          }
        )
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete messages")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Number of messages")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("time")
        .setDescription("Ban duration")
        .setRequired(false)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("unit")
        .setDescription("Time unit")
        .setRequired(false)
        .addChoices(...unitChoices())
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(option =>
      option
        .setName("userid")
        .setDescription("Discord User ID")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("time")
        .setDescription("Timeout duration")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("unit")
        .setDescription("Time unit")
        .setRequired(true)
        .addChoices(...unitChoices())
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a timeout")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove the latest warning")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Show server warnings")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

].map(command => command.toJSON());

// ==================================================
// HELP
// ==================================================

function createHelpEmbed(section, language) {

  if (language === "ar") {

    if (section === "home") {

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("✨ KDBot • مركز المساعدة")
        .setDescription(
          "**أهلاً بك في KDBot!**\n\n" +
          "اختر القسم الذي تريد استعراض أوامره."
        )
        .addFields(
          {
            name: "📊 ┃ المعلومات",
            value: "معلومات وحالة البوت",
            inline: true
          },
          {
            name: "🛠️ ┃ الإدارة",
            value: "أوامر إدارة السيرفر",
            inline: true
          },
          {
            name: "🎮 ┃ الترفيه",
            value: "أوامر الترفيه",
            inline: true
          },
          {
            name: "⚙️ ┃ الإعدادات",
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
        .setTitle("📊 KDBot • المعلومات")
        .setDescription(
          "**أوامر المعلومات وحالة البوت**"
        )
        .addFields({
          name: "🏓 `/ping`",
          value:
            "عرض سرعة الاستجابة والسيرفرات والمستخدمين ومدة التشغيل.",
          inline: false
        });
    }

    if (section === "management") {

      return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("🛠️ KDBot • الإدارة")
        .setDescription(
          "**أوامر إدارة السيرفر**"
        )
        .addFields(
          {
            name: "🧹 `/clear`",
            value:
              "حذف الرسائل. افتراضيًا يحذف آخر 10 رسائل.",
            inline: false
          },
          {
            name: "👢 `/kick`",
            value:
              "طرد عضو.",
            inline: false
          },
          {
            name: "🔨 `/ban`",
            value:
              "حظر عضو بشكل دائم أو مؤقت.",
            inline: false
          },
          {
            name: "🔓 `/unban`",
            value:
              "فك حظر مستخدم.",
            inline: false
          },
          {
            name: "⏱️ `/timeout`",
            value:
              "إعطاء عضو Timeout لمدة تختارها.",
            inline: false
          },
          {
            name: "🔄 `/untimeout`",
            value:
              "إزالة Timeout.",
            inline: false
          },
          {
            name: "⚠️ `/warn`",
            value:
              "إضافة تحذير.",
            inline: false
          },
          {
            name: "❌ `/unwarn`",
            value:
              "إزالة آخر تحذير.",
            inline: false
          },
          {
            name: "📋 `/warnings`",
            value:
              "عرض قائمة التحذيرات في السيرفر.",
            inline: false
          }
        );
    }

    if (section === "fun") {

      return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🎮 KDBot • الترفيه")
        .setDescription(
          "**🚧 قريباً**\n\n" +
          "سيتم إضافة أوامر الترفيه لاحقًا."
        );
    }

    return new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("⚙️ KDBot • الإعدادات")
      .setDescription(
        "**🚧 قريباً**\n\n" +
        "سيتم إضافة إعدادات البوت لاحقًا."
      );
  }

  if (section === "home") {

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("✨ KDBot • Help Center")
      .setDescription(
        "**Welcome to KDBot!**\n\n" +
        "Choose a category below."
      )
      .addFields(
        {
          name: "📊 ┃ Information",
          value: "Bot information and status",
          inline: true
        },
        {
          name: "🛠️ ┃ Management",
          value: "Server management commands",
          inline: true
        },
        {
          name: "🎮 ┃ Fun",
          value: "Fun commands",
          inline: true
        },
        {
          name: "⚙️ ┃ Settings",
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
      .setTitle("📊 KDBot • Information")
      .setDescription(
        "**Information and bot status commands**"
      )
      .addFields({
        name: "🏓 `/ping`",
        value:
          "Show latency, servers, users and uptime.",
        inline: false
      });
  }

  if (section === "management") {

    return new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("🛠️ KDBot • Management")
      .setDescription(
        "**Server management commands**"
      )
      .addFields(
        {
          name: "🧹 `/clear`",
          value:
            "Delete messages. Default is 10.",
          inline: false
        },
        {
          name: "👢 `/kick`",
          value:
            "Kick a member.",
          inline: false
        },
        {
          name: "🔨 `/ban`",
          value:
            "Permanent or temporary ban.",
          inline: false
        },
        {
          name: "🔓 `/unban`",
          value:
            "Unban a user.",
          inline: false
        },
        {
          name: "⏱️ `/timeout`",
          value:
            "Timeout a member.",
          inline: false
        },
        {
          name: "🔄 `/untimeout`",
          value:
            "Remove timeout.",
          inline: false
        },
        {
          name: "⚠️ `/warn`",
          value:
            "Add a warning.",
          inline: false
        },
        {
          name: "❌ `/unwarn`",
          value:
            "Remove latest warning.",
          inline: false
        },
        {
          name: "📋 `/warnings`",
          value:
            "Show server warnings.",
          inline: false
        }
      );
  }

  if (section === "fun") {

    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle("🎮 KDBot • Fun")
      .setDescription(
        "**🚧 Coming Soon**\n\n" +
        "Fun commands will be added later."
      );
  }

  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle("⚙️ KDBot • Settings")
    .setDescription(
      "**🚧 Coming Soon**\n\n" +
      "Settings will be added later."
    );
}

// ==================================================
// HELP BUTTONS
// ==================================================

function createHelpButtons(language) {

  const labels =
    language === "ar"
      ? {
          home: "الرئيسية",
          info: "المعلومات",
          management: "الإدارة",
          fun: "الترفيه",
          settings: "الإعدادات"
        }
      : {
          home: "Home",
          info: "Information",
          management: "Management",
          fun: "Fun",
          settings: "Settings"
        };

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("help_home")
      .setLabel(labels.home)
      .setEmoji("🏠")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("help_info")
      .setLabel(labels.info)
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_management")
      .setLabel(labels.management)
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_fun")
      .setLabel(labels.fun)
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("help_settings")
      .setLabel(labels.settings)
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ==================================================
// TEMP BAN
// ==================================================

async function scheduleTempBan(row) {

  const expires =
    new Date(row.expires_at).getTime();

  const remaining =
    expires - Date.now();

  if (remaining <= 0) {

    try {

      await client.guilds.cache
        .get(row.guild_id)
        ?.members.unban(
          row.user_id,
          "Temporary ban expired"
        );

    } catch {}

    await supabase
      .from("tempbans")
      .delete()
      .eq("id", row.id);

    return;
  }

  if (tempBanTimers.has(row.id)) {
    clearTimeout(
      tempBanTimers.get(row.id)
    );
  }

  const timer = setTimeout(
    async () => {

      try {

        const guild =
          client.guilds.cache.get(
            row.guild_id
          );

        if (guild) {

          await guild.members.unban(
            row.user_id,
            "Temporary ban expired"
          );
        }

      } catch {}

      await supabase
        .from("tempbans")
        .delete()
        .eq("id", row.id);

      tempBanTimers.delete(row.id);

    },
    Math.min(remaining, 2147483647)
  );

  tempBanTimers.set(
    row.id,
    timer
  );
}

// ==================================================
// LOAD TEMP BANS
// ==================================================

async function loadTempBans() {

  const { data, error } =
    await supabase
      .from("tempbans")
      .select("*");

  if (error) {

    console.log(
      "❌ Tempban load:",
      error.message
    );

    return;
  }

  for (const row of data || []) {

    await scheduleTempBan(row);
  }

  console.log(
    `✅ Loaded ${data?.length || 0} temporary bans`
  );
}

// ==================================================
// READY
// ==================================================

client.once(
  "clientReady",
  async () => {

    console.log(
      `✅ Bot online as ${client.user.tag}`
    );

    try {

      const rest = new REST({
        version: "10"
      }).setToken(
        DISCORD_TOKEN
      );

      await rest.put(
        Routes.applicationCommands(
          client.user.id
        ),
        {
          body: commands
        }
      );

      console.log(
        "✅ Slash commands registered!"
      );

      for (
        const guild of
        client.guilds.cache.values()
      ) {

        await saveGuild(
          guild,
          "ar"
        );
      }

      await loadTempBans();

    } catch (error) {

      console.error(
        "❌ Startup error:",
        error.message
      );
    }
  }
);

// ==================================================
// INTERACTIONS
// ==================================================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {

      if (interaction.isButton()) {

        const map = {
          help_home: "home",
          help_info: "info",
          help_management: "management",
          help_fun: "fun",
          help_settings: "settings"
        };

        const section =
          map[interaction.customId];

        if (!section) return;

        const language =
          await getLanguage(
            interaction
          );

        await interaction.update({
          embeds: [
            createHelpEmbed(
              section,
              language
            )
          ],
          components: [
            createHelpButtons(
              language
            )
          ]
        });
      }

      return;
    }

    const language =
      await getLanguage(
        interaction
      );

    // ==================================================
    // LANGUAGE
    // ==================================================

    if (
      interaction.commandName ===
      "language"
    ) {

      const newLanguage =
        interaction.options.getString(
          "language"
        );

      userLanguages.set(
        interaction.user.id,
        newLanguage
      );

      await saveUser(
        interaction,
        newLanguage
      );

      await interaction.reply({
        content:
          newLanguage === "ar"
            ? "✅ تم تغيير اللغة إلى **العربية** 🇮🇶"
            : "✅ Language changed to **English** 🇬🇧",
        ephemeral: true
      });

      return;
    }

    // ==================================================
    // PING
    // ==================================================

    if (
      interaction.commandName ===
      "ping"
    ) {

      const ping =
        Math.round(client.ws.ping);

      const servers =
        client.guilds.cache.size;

      const users =
        client.guilds.cache.reduce(
          (total, guild) =>
            total + guild.memberCount,
          0
        );

      const uptime =
        formatUptime(
          Math.floor(
            process.uptime()
          ),
          language
        );

      const embed =
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(
            language === "ar"
              ? "🟢 KDBot • حالة النظام"
              : "🟢 KDBot • System Status"
          )
          .setDescription(
            language === "ar"
              ? "**🟢 البوت متصل ويعمل بشكل طبيعي**"
              : "**🟢 Bot is online and running normally**"
          )
          .addFields(
            {
              name:
                language === "ar"
                  ? "🏓 سرعة الاستجابة"
                  : "🏓 Response Time",
              value:
                `\`${ping}ms\``,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "💻 السيرفرات"
                  : "💻 Servers",
              value:
                `\`${servers}\``,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "👥 المستخدمون"
                  : "👥 Users",
              value:
                `\`${users.toLocaleString()}\``,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "⏱️ مدة التشغيل"
                  : "⏱️ Uptime",
              value:
                `\`${uptime}\``,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "📡 حالة Discord"
                  : "📡 Discord Status",
              value:
                language === "ar"
                  ? "🟢 متصل"
                  : "🟢 Online",
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "⚙️ الإصدار"
                  : "⚙️ Version",
              value:
                "`v1.0.0`",
              inline: true
            }
          )
          .setFooter({
            text:
              "KDBot • System Status"
          })
          .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    // ==================================================
    // HELP
    // ==================================================

    if (
      interaction.commandName ===
      "help"
    ) {

      await interaction.reply({
        embeds: [
          createHelpEmbed(
            "home",
            language
          )
        ],
        components: [
          createHelpButtons(
            language
          )
        ]
      });

      return;
    }

    // ==================================================
    // CLEAR
    // ==================================================

    if (
      interaction.commandName ===
      "clear"
    ) {

      const amount =
        interaction.options.getInteger(
          "amount"
        ) || 10;

      try {

        const deleted =
          await interaction.channel.bulkDelete(
            amount,
            true
          );

        await interaction.reply({
          content:
            language === "ar"
              ? `🧹 تم حذف **${deleted.size}** رسالة.`
              : `🧹 Deleted **${deleted.size}** messages.`,
          ephemeral: true
        });

      } catch {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لا أستطيع حذف الرسائل. تأكد من صلاحياتي."
              : "❌ I cannot delete messages. Check my permissions.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // KICK
    // ==================================================

    if (
      interaction.commandName ===
      "kick"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const reason =
        interaction.options.getString(
          "reason"
        ) ||
        (
          language === "ar"
            ? "بدون سبب"
            : "No reason provided"
        );

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member || !member.kickable) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لا أستطيع طرد هذا العضو."
              : "❌ I cannot kick this member.",
          ephemeral: true
        });

        return;
      }

      try {

        await member.kick(reason);

        await interaction.reply({
          content:
            language === "ar"
              ? `👢 تم طرد **${user.tag}**.\n📝 ${reason}`
              : `👢 **${user.tag}** was kicked.\n📝 ${reason}`
        });

      } catch {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ حدث خطأ أثناء الطرد."
              : "❌ An error occurred while kicking.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // BAN
    // ==================================================

    if (
      interaction.commandName ===
      "ban"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const time =
        interaction.options.getInteger(
          "time"
        );

      const unit =
        interaction.options.getString(
          "unit"
        );

      const reason =
        interaction.options.getString(
          "reason"
        ) ||
        (
          language === "ar"
            ? "بدون سبب"
            : "No reason provided"
        );

      if (time && !unit) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ اختر وحدة الوقت أيضًا."
              : "❌ Please choose a time unit too.",
          ephemeral: true
        });

        return;
      }

      try {

        await interaction.guild.members.ban(
          user.id,
          {
            reason
          }
        );

        if (time && unit) {

          const duration =
            convertTime(
              time,
              unit
            );

          const expiresAt =
            new Date(
              Date.now() + duration
            ).toISOString();

          const { data, error } =
            await supabase
              .from("tempbans")
              .insert({
                guild_id:
                  interaction.guild.id,
                user_id:
                  user.id,
                username:
                  user.username,
                expires_at:
                  expiresAt,
                moderator_id:
                  interaction.user.id
              })
              .select()
              .single();

          if (error) {

            console.log(
              "❌ Tempban save:",
              error.message
            );

          } else {

            await scheduleTempBan(
              data
            );
          }

          await interaction.reply({
            content:
              language === "ar"
                ? `🔨 تم حظر **${user.tag}** لمدة **${time} ${unit}**.`
                : `🔨 **${user.tag}** was banned for **${time} ${unit}.`
          });

        } else {

          await interaction.reply({
            content:
              language === "ar"
                ? `🔨 تم حظر **${user.tag}** بشكل دائم.`
                : `🔨 **${user.tag}** was permanently banned.`
          });
        }

      } catch (error) {

        console.log(
          "❌ Ban:",
          error.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ حدث خطأ أثناء الحظر."
              : "❌ An error occurred while banning.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // UNBAN
    // ==================================================

    if (
      interaction.commandName ===
      "unban"
    ) {

      const userId =
        interaction.options.getString(
          "userid"
        );

      try {

        await interaction.guild.members.unban(
          userId
        );

        await supabase
          .from("tempbans")
          .delete()
          .eq(
            "guild_id",
            interaction.guild.id
          )
          .eq(
            "user_id",
            userId
          );

        await interaction.reply({
          content:
            language === "ar"
              ? `🔓 تم فك حظر <@${userId}>.`
              : `🔓 <@${userId}> has been unbanned.`
        });

      } catch {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من فك الحظر. تأكد من ID."
              : "❌ I couldn't unban this user. Check the ID.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // TIMEOUT
    // ==================================================

    if (
      interaction.commandName ===
      "timeout"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const time =
        interaction.options.getInteger(
          "time"
        );

      const unit =
        interaction.options.getString(
          "unit"
        );

      const reason =
        interaction.options.getString(
          "reason"
        ) ||
        (
          language === "ar"
            ? "بدون سبب"
            : "No reason provided"
        );

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member || !member.moderatable) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لا أستطيع إعطاء هذا العضو Timeout."
              : "❌ I cannot timeout this member.",
          ephemeral: true
        });

        return;
      }

      const duration =
        convertTime(
          time,
          unit
        );

      try {

        await member.timeout(
          duration,
          reason
        );

        await interaction.reply({
          content:
            language === "ar"
              ? `⏱️ تم إعطاء **${user.tag}** Timeout لمدة **${time} ${unit}**.`
              : `⏱️ **${user.tag}** was timed out for **${time} ${unit}**.`
        });

      } catch {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ حدث خطأ أثناء إعطاء Timeout."
              : "❌ An error occurred while applying timeout.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // UNTIMEOUT
    // ==================================================

    if (
      interaction.commandName ===
      "untimeout"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ العضو غير موجود."
              : "❌ Member not found.",
          ephemeral: true
        });

        return;
      }

      try {

        await member.timeout(
          null,
          "Timeout removed"
        );

        await interaction.reply({
          content:
            language === "ar"
              ? `🔄 تم إزالة Timeout عن **${user.tag}**.`
              : `🔄 Timeout removed from **${user.tag}**.`
        });

      } catch {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من إزالة Timeout."
              : "❌ I couldn't remove the timeout.",
          ephemeral: true
        });
      }

      return;
    }

    // ==================================================
    // WARN
    // ==================================================

    if (
      interaction.commandName ===
      "warn"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const reason =
        interaction.options.getString(
          "reason"
        ) ||
        (
          language === "ar"
            ? "بدون سبب"
            : "No reason provided"
        );

      const { error } =
        await supabase
          .from("warnings")
          .insert({
            guild_id:
              interaction.guild.id,
            user_id:
              user.id,
            username:
              user.username,
            reason,
            moderator_id:
              interaction.user.id
          });

      if (error) {

        console.log(
          "❌ Warning save:",
          error.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من حفظ التحذير."
              : "❌ I couldn't save the warning.",
          ephemeral: true
        });

        return;
      }

      await interaction.reply({
        content:
          language === "ar"
            ? `⚠️ تم تحذير **${user.tag}**.\n📝 السبب: ${reason}`
            : `⚠️ **${user.tag}** has been warned.\n📝 Reason: ${reason}`
      });

      return;
    }

    // ==================================================
    // UNWARN
    // ==================================================

    if (
      interaction.commandName ===
      "unwarn"
    ) {

      const user =
        interaction.options.getUser(
          "user"
        );

      const { data, error } =
        await supabase
          .from("warnings")
          .select("id")
          .eq(
            "guild_id",
            interaction.guild.id
          )
          .eq(
            "user_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          )
          .limit(1);

      if (
        error ||
        !data ||
        data.length === 0
      ) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ هذا العضو لا يملك تحذيرات."
              : "❌ This member has no warnings.",
          ephemeral: true
        });

        return;
      }

      const { error: deleteError } =
        await supabase
          .from("warnings")
          .delete()
          .eq(
            "id",
            data[0].id
          );

      if (deleteError) {

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من إزالة التحذير."
              : "❌ I couldn't remove the warning.",
          ephemeral: true
        });

        return;
      }

      await interaction.reply({
        content:
          language === "ar"
            ? `✅ تمت إزالة آخر تحذير عن **${user.tag}**.`
            : `✅ The latest warning for **${user.tag}** was removed.`
      });

      return;
    }

    // ==================================================
    // WARNINGS
    // ==================================================

    if (
      interaction.commandName ===
      "warnings"
    ) {

      const { data, error } =
        await supabase
          .from("warnings")
          .select(
            "user_id, username"
          )
          .eq(
            "guild_id",
            interaction.guild.id
          );

      if (error) {

        console.log(
          "❌ Warnings:",
          error.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من جلب التحذيرات."
              : "❌ I couldn't load the warnings.",
          ephemeral: true
        });

        return;
      }

      if (!data || data.length === 0) {

        await interaction.reply({
          content:
            language === "ar"
              ? "✅ لا توجد تحذيرات في هذا السيرفر."
              : "✅ There are no warnings in this server.",
          ephemeral: true
        });

        return;
      }

      const counts = {};

      for (const warning of data) {

        if (!counts[warning.user_id]) {

          counts[warning.user_id] = {
            username:
              warning.username,
            count: 0
          };
        }

        counts[
          warning.user_id
        ].count++;
      }

      const list =
        Object.entries(counts)
          .map(
            ([userId, info]) =>
              `⚠️ **${info.username}** — \`${info.count}\` ${language === "ar" ? "تحذير" : "warnings"}`
          )
          .join("\n");

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(
            language === "ar"
              ? "⚠️ قائمة التحذيرات"
              : "⚠️ Warning List"
          )
          .setDescription(
            list
          )
          .setFooter({
            text:
              language === "ar"
                ? `إجمالي التحذيرات: ${data.length}`
                : `Total warnings: ${data.length}`
          })
          .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }
  }
);

// ==================================================
// LOGIN
// ==================================================

client.login(
  DISCORD_TOKEN
)
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

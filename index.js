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

// ==================================================
// DISCORD CLIENT
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==================================================
// CACHE
// ==================================================

const userLanguages = new Map();
const guildLanguages = new Map();
const tempBanTimers = new Map();

// ==================================================
// WARNINGS SETTINGS
// ==================================================

const WARNINGS_PER_PAGE = 10;

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
      data[0].language === "en" ? "en" : "ar";

    userLanguages.set(userId, language);

    return language;
  }

  const language =
    interaction.locale &&
    interaction.locale.toLowerCase().startsWith("ar")
      ? "ar"
      : "en";

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
    const { error: updateError } = await supabase
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
    const { error: insertError } = await supabase
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
    const { error: insertError } = await supabase
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

  // PING
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show bot status"),

  // HELP
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open KDBot help center"),

  // LANGUAGE
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

  // CLEAR
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

  // KICK
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

  // BAN
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

  // UNBAN
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

  // TIMEOUT
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

  // UNTIMEOUT
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

  // WARN
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

  // UNWARN
  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove a specific warning")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("warning_number")
        .setDescription("Warning number to remove")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  // WARNINGS
  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Show warning history")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Show warnings for this member only")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

].map(command => command.toJSON());

// ==================================================
// HELP
// ==================================================

function createHelpEmbed(section, language) {

  const isArabic = language === "ar";

  if (section === "home") {
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(
        isArabic
          ? "✨ KDBot • مركز المساعدة"
          : "✨ KDBot • Help Center"
      )
      .setDescription(
        isArabic
          ? "**أهلاً بك في KDBot!**\n\nاختر القسم الذي تريد استعراض أوامره."
          : "**Welcome to KDBot!**\n\nChoose a category below."
      )
      .addFields(
        {
          name: isArabic
            ? "📊 ┃ المعلومات"
            : "📊 ┃ Information",
          value: isArabic
            ? "معلومات وحالة البوت"
            : "Bot information and status",
          inline: true
        },
        {
          name: isArabic
            ? "🛠️ ┃ الإدارة"
            : "🛠️ ┃ Management",
          value: isArabic
            ? "أوامر إدارة السيرفر"
            : "Server management commands",
          inline: true
        },
        {
          name: isArabic
            ? "🎮 ┃ الترفيه"
            : "🎮 ┃ Fun",
          value: isArabic
            ? "أوامر الترفيه"
            : "Fun commands",
          inline: true
        },
        {
          name: isArabic
            ? "⚙️ ┃ الإعدادات"
            : "⚙️ ┃ Settings",
          value: isArabic
            ? "إعدادات البوت"
            : "Bot settings",
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
      .setTitle(
        isArabic
          ? "📊 KDBot • المعلومات"
          : "📊 KDBot • Information"
      )
      .setDescription(
        isArabic
          ? "**أوامر المعلومات وحالة البوت**"
          : "**Information and bot status commands**"
      )
      .addFields({
        name: "🏓 `/ping`",
        value: isArabic
          ? "عرض سرعة الاستجابة والسيرفرات والمستخدمين ومدة التشغيل."
          : "Show latency, servers, users and uptime.",
        inline: false
      });
  }

  if (section === "management") {
    return new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle(
        isArabic
          ? "🛠️ KDBot • الإدارة"
          : "🛠️ KDBot • Management"
      )
      .setDescription(
        isArabic
          ? "**أوامر إدارة السيرفر**"
          : "**Server management commands**"
      )
      .addFields(
        {
          name: "🧹 `/clear`",
          value: isArabic
            ? "حذف الرسائل."
            : "Delete messages."
        },
        {
          name: "👢 `/kick`",
          value: isArabic
            ? "طرد عضو."
            : "Kick a member."
        },
        {
          name: "🔨 `/ban`",
          value: isArabic
            ? "حظر عضو بشكل دائم أو مؤقت."
            : "Permanent or temporary ban."
        },
        {
          name: "🔓 `/unban`",
          value: isArabic
            ? "فك حظر مستخدم."
            : "Unban a user."
        },
        {
          name: "⏱️ `/timeout`",
          value: isArabic
            ? "إعطاء عضو Timeout."
            : "Timeout a member."
        },
        {
          name: "🔄 `/untimeout`",
          value: isArabic
            ? "إزالة Timeout."
            : "Remove timeout."
        },
        {
          name: "⚠️ `/warn`",
          value: isArabic
            ? "إضافة تحذير."
            : "Add a warning."
        },
        {
          name: "❌ `/unwarn`",
          value: isArabic
            ? "إزالة تحذير محدد بالرقم."
            : "Remove a specific warning by number."
        },
        {
          name: "📋 `/warnings`",
          value: isArabic
            ? "عرض جميع التحذيرات أو تحذيرات عضو محدد."
            : "Show all warnings or warnings for a specific member."
        }
      );
  }

  if (section === "fun") {
    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(
        isArabic
          ? "🎮 KDBot • الترفيه"
          : "🎮 KDBot • Fun"
      )
      .setDescription(
        isArabic
          ? "**🚧 قريباً**\n\nسيتم إضافة أوامر الترفيه لاحقًا."
          : "**🚧 Coming Soon**\n\nFun commands will be added later."
      );
  }

  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(
      isArabic
        ? "⚙️ KDBot • الإعدادات"
        : "⚙️ KDBot • Settings"
    )
    .setDescription(
      isArabic
        ? "**🚧 قريباً**\n\nسيتم إضافة إعدادات البوت لاحقًا."
        : "**🚧 Coming Soon**\n\nBot settings will be added later."
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
      const guild =
        client.guilds.cache.get(row.guild_id);

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
          client.guilds.cache.get(row.guild_id);

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
    Math.min(
      remaining,
      2147483647
    )
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
// WARNING NUMBER
// ==================================================
//
// رقم التحذير يحسب حسب تاريخ التحذير.
// الأقدم = #1
// الأحدث = الرقم الأعلى.
//
// ==================================================

function assignWarningNumbers(warnings) {

  const sorted = [...warnings].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );

  return sorted.map(
    (warning, index) => ({
      ...warning,
      warning_number: index + 1
    })
  );
}

// ==================================================
// WARNING PAGINATION
// ==================================================

function createWarningsEmbed({
  warnings,
  page,
  language,
  targetUser
}) {

  const numberedWarnings =
    assignWarningNumbers(warnings);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        numberedWarnings.length /
        WARNINGS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(page, 0),
      totalPages - 1
    );

  const start =
    safePage * WARNINGS_PER_PAGE;

  const pageWarnings =
    numberedWarnings.slice(
      start,
      start + WARNINGS_PER_PAGE
    );

  const isArabic =
    language === "ar";

  const description =
    pageWarnings
      .map(warning => {

        const time =
          warning.created_at
            ? `<t:${Math.floor(
                new Date(
                  warning.created_at
                ).getTime() / 1000
              )}:F>`
            : (
                isArabic
                  ? "وقت غير معروف"
                  : "Unknown time"
              );

        const memberName =
          warning.username ||
          warning.user_id;

        return [
          `**#${warning.warning_number} — ⚠️ ${memberName}**`,
          `🆔 \`${warning.user_id}\``,
          `📝 ${warning.reason || (
            isArabic
              ? "بدون سبب"
              : "No reason"
          )}`,
          `👮 <@${warning.moderator_id}>`,
          `🕐 ${time}`
        ].join("\n");

      })
      .join("\n\n");

  const title =
    targetUser
      ? (
          isArabic
            ? `⚠️ تحذيرات ${targetUser.username}`
            : `⚠️ Warnings for ${targetUser.username}`
        )
      : (
          isArabic
            ? "⚠️ سجل التحذيرات"
            : "⚠️ Warning History"
        );

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(
      description ||
      (
        isArabic
          ? "لا توجد تحذيرات في هذه الصفحة."
          : "There are no warnings on this page."
      )
    )
    .setFooter({
      text:
        isArabic
          ? `صفحة ${safePage + 1}/${totalPages} • إجمالي التحذيرات: ${numberedWarnings.length}`
          : `Page ${safePage + 1}/${totalPages} • Total warnings: ${numberedWarnings.length}`
    })
    .setTimestamp();
}

// ==================================================
// WARNING PAGINATION BUTTONS
// ==================================================

function createWarningsButtons({
  ownerId,
  page,
  totalPages
}) {

  const previous =
    new ButtonBuilder()
      .setCustomId(
        `warnings_prev:${ownerId}:${page}`
      )
      .setLabel("السابق")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0);

  const next =
    new ButtonBuilder()
      .setCustomId(
        `warnings_next:${ownerId}:${page}`
      )
      .setLabel("التالي")
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(
        page >= totalPages - 1
      );

  return new ActionRowBuilder()
    .addComponents(
      previous,
      next
    );
}

// ==================================================
// READY
// ==================================================

client.once(
  "clientReady",
  async () => {

    console.log(
      `[SUCCESS] Bot online as ${client.user.tag}`
    );

    try {

      const rest =
        new REST({
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
        "[SUCCESS] Slash commands registered!"
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

      console.log(
        `[SUCCESS] Startup complete | Servers: ${client.guilds.cache.size} | Ping: ${client.ws.ping}ms`
      );

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

    // ==================================================
    // BUTTONS
    // ==================================================

    if (interaction.isButton()) {

      // ----------------------------------------------
      // HELP BUTTONS
      // ----------------------------------------------

      const helpMap = {
        help_home: "home",
        help_info: "info",
        help_management: "management",
        help_fun: "fun",
        help_settings: "settings"
      };

      if (
        helpMap[interaction.customId]
      ) {

        const language =
          await getLanguage(
            interaction
          );

        await interaction.update({
          embeds: [
            createHelpEmbed(
              helpMap[
                interaction.customId
              ],
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

      // ----------------------------------------------
      // WARNING PAGINATION
      // ----------------------------------------------

      if (
        interaction.customId.startsWith(
          "warnings_prev:"
        ) ||
        interaction.customId.startsWith(
          "warnings_next:"
        )
      ) {

        const parts =
          interaction.customId.split(":");

        const action = parts[0];
        const ownerId = parts[1];
        const oldPage =
          Number(parts[2]);

        // فقط الشخص الذي فتح القائمة
        if (
          interaction.user.id !== ownerId
        ) {

          await interaction.reply({
            content:
              "❌ هذه القائمة ليست لك. استخدم `/warnings` لفتح قائمتك الخاصة.",
            ephemeral: true
          });

          return;
        }

        let newPage =
          oldPage;

        if (action === "warnings_prev") {
          newPage--;
        }

        if (action === "warnings_next") {
          newPage++;
        }

        if (newPage < 0) {
          newPage = 0;
        }

        const language =
          await getLanguage(
            interaction
          );

        const { data, error } =
          await supabase
            .from("warnings")
            .select(
              "id, user_id, username, reason, moderator_id, created_at"
            )
            .eq(
              "guild_id",
              interaction.guild.id
            )
            .order(
              "created_at",
              {
                ascending: true
              }
            );

        if (error) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ حدث خطأ أثناء تحديث الصفحة."
                : "❌ An error occurred while updating the page.",
            ephemeral: true
          });

          return;
        }

        const totalPages =
          Math.max(
            1,
            Math.ceil(
              (data?.length || 0) /
              WARNINGS_PER_PAGE
            )
          );

        if (
          newPage >= totalPages
        ) {
          newPage =
            totalPages - 1;
        }

        await interaction.update({
          embeds: [
            createWarningsEmbed({
              warnings: data || [],
              page: newPage,
              language,
              targetUser: null
            })
          ],
          components: [
            createWarningsButtons({
              ownerId,
              page: newPage,
              totalPages
            })
          ]
        });

        return;
      }

      return;
    }

    // ==================================================
    // CHAT COMMANDS
    // ==================================================

    if (
      !interaction.isChatInputCommand()
    ) {
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
              : "❌ I cannot delete the messages. Check my permissions.",
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

      if (
        !member ||
        !member.kickable
      ) {

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

      if (
        time &&
        !unit
      ) {

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

        if (
          time &&
          unit
        ) {

          const duration =
            convertTime(
              time,
              unit
            );

          const expiresAt =
            new Date(
              Date.now() + duration
            ).toISOString();

          const {
            data,
            error
          } =
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
                : `🔨 **${user.tag}** was banned for **${time} ${unit}**.`
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

      if (
        !member ||
        !member.moderatable
      ) {

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

      const {
        data: existingWarnings,
        error: countError
      } =
        await supabase
          .from("warnings")
          .select(
            "id"
          )
          .eq(
            "guild_id",
            interaction.guild.id
          )
          .eq(
            "user_id",
            user.id
          );

      if (countError) {

        console.log(
          "❌ Warning count:",
          countError.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ حدث خطأ أثناء جلب عدد التحذيرات."
              : "❌ An error occurred while checking warnings.",
          ephemeral: true
        });

        return;
      }

      const warningNumber =
        (existingWarnings?.length || 0) + 1;

      const {
        data: warningData,
        error
      } =
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
          })
          .select(
            "created_at"
          )
          .single();

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

      const warningTime =
        warningData?.created_at
          ? `<t:${Math.floor(
              new Date(
                warningData.created_at
              ).getTime() / 1000
            )}:F>`
          : `<t:${Math.floor(
              Date.now() / 1000
            )}:F>`;

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(
            language === "ar"
              ? "⚠️ تحذير جديد"
              : "⚠️ New Warning"
          )
          .setThumbnail(
            user.displayAvatarURL({
              dynamic: true
            })
          )
          .addFields(
            {
              name:
                language === "ar"
                  ? "👤 الاسم"
                  : "👤 Name",
              value:
                user.globalName ||
                user.username,
              inline: true
            },
            {
              name:
                "🏷️ Username",
              value:
                `@${user.username}`,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "🆔 المعرّف"
                  : "🆔 User ID",
              value:
                `\`${user.id}\``,
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "📝 السبب"
                  : "📝 Reason",
              value:
                reason,
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "🕐 الوقت"
                  : "🕐 Time",
              value:
                warningTime,
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "👮 المشرف"
                  : "👮 Moderator",
              value:
                `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "🔢 رقم التحذير"
                  : "🔢 Warning #",
              value:
                `\`${warningNumber}\``,
              inline: true
            }
          )
          .setFooter({
            text:
              language === "ar"
                ? `السيرفر: ${interaction.guild.name}`
                : `Server: ${interaction.guild.name}`
          })
          .setTimestamp();

      await interaction.reply({
        embeds: [embed]
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

      const warningNumber =
        interaction.options.getInteger(
          "warning_number"
        );

      // ----------------------------------------------
      // GET ALL WARNINGS FOR USER
      // ----------------------------------------------

      const {
        data,
        error
      } =
        await supabase
          .from("warnings")
          .select(
            "id, user_id, username, reason, created_at, moderator_id"
          )
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
              ascending: true
            }
          );

      if (error) {

        console.log(
          "❌ Warning lookup:",
          error.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ حدث خطأ أثناء جلب التحذيرات."
              : "❌ An error occurred while loading warnings.",
          ephemeral: true
        });

        return;
      }

      if (
        !data ||
        data.length === 0
      ) {

        await interaction.reply({
          content:
            language === "ar"
              ? `❌ **${user.username}** لا يملك أي تحذيرات.`
              : `❌ **${user.username}** has no warnings.`,
          ephemeral: true
        });

        return;
      }

      const numberedWarnings =
        assignWarningNumbers(
          data
        );

      const warning =
        numberedWarnings.find(
          item =>
            item.warning_number ===
            warningNumber
        );

      if (!warning) {

        await interaction.reply({
          content:
            language === "ar"
              ? `❌ لا يوجد تحذير بالرقم **#${warningNumber}** لهذا العضو.\n📊 لديه حاليًا **${numberedWarnings.length}** تحذير.`
              : `❌ Warning **#${warningNumber}** does not exist for this member.\n📊 They currently have **${numberedWarnings.length}** warnings.`,
          ephemeral: true
        });

        return;
      }

      // ----------------------------------------------
      // DELETE EXACT WARNING
      // ----------------------------------------------

      const {
        error: deleteError
      } =
        await supabase
          .from("warnings")
          .delete()
          .eq(
            "id",
            warning.id
          )
          .eq(
            "guild_id",
            interaction.guild.id
          );

      if (deleteError) {

        console.log(
          "❌ Warning delete:",
          deleteError.message
        );

        await interaction.reply({
          content:
            language === "ar"
              ? "❌ لم أتمكن من إزالة التحذير."
              : "❌ I couldn't remove the warning.",
          ephemeral: true
        });

        return;
      }

      // ----------------------------------------------
      // SUCCESS EMBED
      // ----------------------------------------------

      const embed =
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(
            language === "ar"
              ? "✅ تمت إزالة التحذير"
              : "✅ Warning Removed"
          )
          .setThumbnail(
            user.displayAvatarURL({
              dynamic: true
            })
          )
          .addFields(
            {
              name:
                language === "ar"
                  ? "👤 العضو"
                  : "👤 Member",
              value:
                `${user.globalName || user.username} (@${user.username})`,
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "🔢 رقم التحذير"
                  : "🔢 Warning Number",
              value:
                `#${warning.warning_number}`,
              inline: true
            },
            {
              name:
                language === "ar"
                  ? "📝 سبب التحذير"
                  : "📝 Warning Reason",
              value:
                warning.reason ||
                (
                  language === "ar"
                    ? "بدون سبب"
                    : "No reason"
                ),
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "🕐 تاريخ التحذير"
                  : "🕐 Warning Date",
              value:
                warning.created_at
                  ? `<t:${Math.floor(
                      new Date(
                        warning.created_at
                      ).getTime() / 1000
                    )}:F>`
                  : (
                      language === "ar"
                        ? "غير معروف"
                        : "Unknown"
                    ),
              inline: false
            },
            {
              name:
                language === "ar"
                  ? "👮 أزال التحذير"
                  : "👮 Removed By",
              value:
                `<@${interaction.user.id}>`,
              inline: true
            }
          )
          .setTimestamp();

      await interaction.reply({
        embeds: [embed]
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

      const targetUser =
        interaction.options.getUser(
          "user"
        );

      let query =
        supabase
          .from("warnings")
          .select(
            "id, user_id, username, reason, moderator_id, created_at"
          )
          .eq(
            "guild_id",
            interaction.guild.id
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          );

      // ----------------------------------------------
      // IF USER WAS PROVIDED
      // ----------------------------------------------

      if (targetUser) {

        query =
          query.eq(
            "user_id",
            targetUser.id
          );

      }

      const {
        data,
        error
      } =
        await query;

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

      if (
        !data ||
        data.length === 0
      ) {

        await interaction.reply({
          content:
            targetUser
              ? (
                  language === "ar"
                    ? `✅ **${targetUser.username}** لا يملك أي تحذيرات.`
                    : `✅ **${targetUser.username}** has no warnings.`
                )
              : (
                  language === "ar"
                    ? "✅ لا توجد تحذيرات في هذا السيرفر."
                    : "✅ There are no warnings in this server."
                ),
          ephemeral: true
        });

        return;
      }

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            data.length /
            WARNINGS_PER_PAGE
          )
        );

      const page = 0;

      await interaction.reply({
        embeds: [
          createWarningsEmbed({
            warnings: data,
            page,
            language,
            targetUser
          })
        ],
        components: [
          createWarningsButtons({
            ownerId:
              interaction.user.id,
            page,
            totalPages
          })
        ]
      });

      console.log(
        `[WARNINGS] ${interaction.user.tag} viewed ${
          targetUser
            ? `warnings for ${targetUser.tag}`
            : "server warnings"
        }`
      );

      return;
    }

  }
);

// ==================================================
// LOGIN
// ==================================================

console.log(
  "🔑 Token loaded:",
  !!DISCORD_TOKEN
);

console.log(
  "🔑 Token length:",
  DISCORD_TOKEN
    ? DISCORD_TOKEN.length
    : 0
);

console.log(
  "🚀 Starting Discord login..."
);

console.log(
  "🌐 Testing Discord API connection..."
);

fetch(
  "https://discord.com/api/v10/gateway"
)
  .then(async response => {

    console.log(
      "🌐 Discord API status:",
      response.status
    );

    const text =
      await response.text();

    console.log(
      "🌐 Discord API response:",
      text
    );

    if (
      response.status !== 200
    ) {

      throw new Error(
        `Discord API returned HTTP ${response.status}: ${text}`
      );
    }

    console.log(
      "🚀 Attempting Discord login..."
    );

    return client.login(
      DISCORD_TOKEN
    );
  })
  .then(() => {

    console.log(
      "[SUCCESS] Discord login successful!"
    );

  })
  .catch(error => {

    console.error(
      "❌ Discord connection/login failed:"
    );

    console.error(
      error
    );

    process.exit(1);

  });

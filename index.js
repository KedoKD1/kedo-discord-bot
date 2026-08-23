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
// CONSTANTS
// ==================================================

const WARNINGS_PER_PAGE = 5;

// ==================================================
// LOGGING
// ==================================================

function logInfo(message, ...args) {
  console.log(`[INFO] ${message}`, ...args);
}

function logSuccess(message, ...args) {
  console.log(`[SUCCESS] ${message}`, ...args);
}

function logWarning(message, ...args) {
  console.warn(`[WARNING] ${message}`, ...args);
}

function logError(context, error) {
  console.error(
    `[ERROR] ${context}:`,
    error?.message || error
  );
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
// DATE FORMAT
// ==================================================

function formatWarningDate(date, language) {
  if (!date) {
    return language === "ar"
      ? "وقت غير معروف"
      : "Unknown time";
  }

  const timestamp = Math.floor(
    new Date(date).getTime() / 1000
  );

  if (Number.isNaN(timestamp)) {
    return language === "ar"
      ? "وقت غير معروف"
      : "Unknown time";
  }

  // Discord timestamp:
  // F = full date/time according to user's Discord locale
  // R = relative time
  return `<t:${timestamp}:F>`;
}

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

    userLanguages.set(
      userId,
      language
    );

    return language;
  }

  const language =
    interaction.locale &&
    interaction.locale
      .toLowerCase()
      .startsWith("ar")
      ? "ar"
      : "en";

  userLanguages.set(
    userId,
    language
  );

  await saveUser(
    interaction,
    language
  );

  return language;
}

// ==================================================
// SAVE USER
// ==================================================

async function saveUser(
  interaction,
  language
) {
  const discordId =
    interaction.user.id;

  const username =
    interaction.user.username;

  const { data, error } =
    await supabase
      .from("users")
      .select("id")
      .eq(
        "discord_id",
        discordId
      )
      .limit(1);

  if (error) {
    logError(
      "User lookup",
      error
    );

    return;
  }

  if (
    data &&
    data.length > 0
  ) {
    const {
      error: updateError
    } = await supabase
      .from("users")
      .update({
        username,
        language
      })
      .eq(
        "discord_id",
        discordId
      );

    if (updateError) {
      logError(
        "User update",
        updateError
      );
    }
  } else {
    const {
      error: insertError
    } = await supabase
      .from("users")
      .insert({
        discord_id: discordId,
        username,
        language
      });

    if (insertError) {
      logError(
        "User insert",
        insertError
      );
    }
  }
}

// ==================================================
// SAVE GUILD
// ==================================================

async function saveGuild(
  guild,
  language = "ar"
) {
  if (!guild) return;

  const {
    data,
    error
  } = await supabase
    .from("guilds")
    .select("id")
    .eq(
      "guild_id",
      guild.id
    )
    .limit(1);

  if (error) {
    logError(
      "Guild lookup",
      error
    );

    return;
  }

  if (
    data &&
    data.length > 0
  ) {
    const {
      error: updateError
    } = await supabase
      .from("guilds")
      .update({
        language
      })
      .eq(
        "guild_id",
        guild.id
      );

    if (updateError) {
      logError(
        "Guild update",
        updateError
      );
    }
  } else {
    const {
      error: insertError
    } = await supabase
      .from("guilds")
      .insert({
        guild_id:
          guild.id,
        language
      });

    if (insertError) {
      logError(
        "Guild insert",
        insertError
      );
    }
  }

  guildLanguages.set(
    guild.id,
    language
  );
}

// ==================================================
// SUPABASE HEALTH CHECK
// ==================================================

async function checkSupabase() {
  const started =
    Date.now();

  try {
    const {
      error
    } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    const duration =
      Date.now() - started;

    if (error) {
      logWarning(
        `Supabase check failed after ${duration}ms: ${error.message}`
      );

      return false;
    }

    logSuccess(
      `Supabase connection OK (${duration}ms)`
    );

    return true;
  } catch (error) {
    logError(
      "Supabase health check",
      error
    );

    return false;
  }
}

// ==================================================
// HELP EMBED
// ==================================================

function createHelpEmbed(
  section,
  language
) {
  const isArabic =
    language === "ar";

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
          name:
            isArabic
              ? "📊 ┃ المعلومات"
              : "📊 ┃ Information",

          value:
            isArabic
              ? "معلومات وحالة البوت"
              : "Bot information and status",

          inline: true
        },
        {
          name:
            isArabic
              ? "🛠️ ┃ الإدارة"
              : "🛠️ ┃ Management",

          value:
            isArabic
              ? "أوامر إدارة السيرفر"
              : "Server management commands",

          inline: true
        },
        {
          name:
            isArabic
              ? "🎮 ┃ الترفيه"
              : "🎮 ┃ Fun",

          value:
            isArabic
              ? "أوامر الترفيه"
              : "Fun commands",

          inline: true
        },
        {
          name:
            isArabic
              ? "⚙️ ┃ الإعدادات"
              : "⚙️ ┃ Settings",

          value:
            isArabic
              ? "إعدادات البوت"
              : "Bot settings",

          inline: true
        }
      )
      .setFooter({
        text:
          "KDBot • Help Center"
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

        value:
          isArabic
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
          value:
            isArabic
              ? "حذف الرسائل."
              : "Delete messages."
        },
        {
          name: "👢 `/kick`",
          value:
            isArabic
              ? "طرد عضو."
              : "Kick a member."
        },
        {
          name: "🔨 `/ban`",
          value:
            isArabic
              ? "حظر عضو بشكل دائم أو مؤقت."
              : "Permanent or temporary ban."
        },
        {
          name: "🔓 `/unban`",
          value:
            isArabic
              ? "فك حظر مستخدم."
              : "Unban a user."
        },
        {
          name: "⏱️ `/timeout`",
          value:
            isArabic
              ? "إعطاء عضو Timeout."
              : "Timeout a member."
        },
        {
          name: "🔄 `/untimeout`",
          value:
            isArabic
              ? "إزالة Timeout."
              : "Remove timeout."
        },
        {
          name: "⚠️ `/warn`",
          value:
            isArabic
              ? "إضافة تحذير مع حفظ معلوماته."
              : "Add a warning and save its information."
        },
        {
          name: "❌ `/unwarn`",
          value:
            isArabic
              ? "إزالة تحذير محدد برقم التحذير."
              : "Remove a specific warning by number."
        },
        {
          name: "📋 `/warnings`",
          value:
            isArabic
              ? "عرض سجل التحذيرات مع الصفحات."
              : "Show warning history with pages."
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

function createHelpButtons(
  language
) {
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

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "help_home"
        )
        .setLabel(
          labels.home
        )
        .setEmoji("🏠")
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "help_info"
        )
        .setLabel(
          labels.info
        )
        .setEmoji("📊")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          "help_management"
        )
        .setLabel(
          labels.management
        )
        .setEmoji("🛠️")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          "help_fun"
        )
        .setLabel(
          labels.fun
        )
        .setEmoji("🎮")
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          "help_settings"
        )
        .setLabel(
          labels.settings
        )
        .setEmoji("⚙️")
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

// ==================================================
// TEMP BAN
// ==================================================

async function scheduleTempBan(
  row
) {
  const expires =
    new Date(
      row.expires_at
    ).getTime();

  const remaining =
    expires - Date.now();

  if (remaining <= 0) {
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
    } catch (error) {
      logWarning(
        `Could not unban expired user ${row.user_id}: ${error.message}`
      );
    }

    const {
      error
    } = await supabase
      .from("tempbans")
      .delete()
      .eq(
        "id",
        row.id
      );

    if (error) {
      logError(
        "Delete expired tempban",
        error
      );
    }

    return;
  }

  if (
    tempBanTimers.has(
      row.id
    )
  ) {
    clearTimeout(
      tempBanTimers.get(
        row.id
      )
    );
  }

  const timer =
    setTimeout(
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
        } catch (error) {
          logWarning(
            `Temporary ban expiration error: ${error.message}`
          );
        }

        const {
          error
        } = await supabase
          .from("tempbans")
          .delete()
          .eq(
            "id",
            row.id
          );

        if (error) {
          logError(
            "Delete expired tempban",
            error
          );
        }

        tempBanTimers.delete(
          row.id
        );
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
  const {
    data,
    error
  } = await supabase
    .from("tempbans")
    .select("*");

  if (error) {
    logError(
      "Tempban load",
      error
    );

    return;
  }

  for (
    const row of data || []
  ) {
    await scheduleTempBan(
      row
    );
  }

  logSuccess(
    `Loaded ${data?.length || 0} temporary bans`
  );
}

// ==================================================
// WARNING DATA
// ==================================================

async function getUserWarnings(
  guildId,
  userId
) {
  const {
    data,
    error
  } = await supabase
    .from("warnings")
    .select(
      "id, user_id, username, reason, moderator_id, created_at"
    )
    .eq(
      "guild_id",
      guildId
    )
    .eq(
      "user_id",
      userId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

  if (error) {
    logError(
      "Get user warnings",
      error
    );

    return null;
  }

  return data || [];
}

// ==================================================
// WARNING PAGE EMBED
// ==================================================

function createWarningsEmbed(
  warnings,
  page,
  language,
  guild
) {
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        warnings.length /
          WARNINGS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(page, 0),
      totalPages - 1
    );

  const start =
    safePage *
    WARNINGS_PER_PAGE;

  const pageWarnings =
    warnings.slice(
      start,
      start +
        WARNINGS_PER_PAGE
    );

  const description =
    pageWarnings
      .map(
        (
          warning,
          index
        ) => {
          const number =
            start +
            index +
            1;

          const time =
            formatWarningDate(
              warning.created_at,
              language
            );

          const reason =
            warning.reason ||
            (
              language === "ar"
                ? "بدون سبب"
                : "No reason"
            );

          return (
            `**#${number} ┃ ⚠️ ${warning.username}**\n` +
            `🆔 \`${warning.user_id}\`\n` +
            `📝 ${reason}\n` +
            `👮 <@${warning.moderator_id}>\n` +
            `🕐 ${time}`
          );
        }
      )
      .join(
        "\n\n"
      );

  return new EmbedBuilder()
    .setColor(
      0xF1C40F
    )
    .setTitle(
      language === "ar"
        ? "⚠️ سجل التحذيرات"
        : "⚠️ Warning History"
    )
    .setDescription(
      description ||
        (
          language === "ar"
            ? "لا توجد تحذيرات."
            : "No warnings."
        )
    )
    .setFooter({
      text:
        language === "ar"
          ? `صفحة ${safePage + 1} من ${totalPages} • إجمالي التحذيرات: ${warnings.length}`
          : `Page ${safePage + 1} of ${totalPages} • Total warnings: ${warnings.length}`
    })
    .setTimestamp();
}

// ==================================================
// WARNING PAGE BUTTONS
// ==================================================

function createWarningsButtons(
  page,
  totalPages,
  ownerId,
  language
) {
  const row =
    new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(
        `warnings_prev:${ownerId}:${page}`
      )
      .setEmoji("◀️")
      .setLabel(
        language === "ar"
          ? "السابق"
          : "Previous"
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page <= 0
      ),

    new ButtonBuilder()
      .setCustomId(
        `warnings_page:${ownerId}:${page}`
      )
      .setLabel(
        `${page + 1} / ${totalPages}`
      )
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(
        true
      ),

    new ButtonBuilder()
      .setCustomId(
        `warnings_next:${ownerId}:${page}`
      )
      .setEmoji("▶️")
      .setLabel(
        language === "ar"
          ? "التالي"
          : "Next"
      )
      .setStyle(
        ButtonStyle.Secondary
      )
      .setDisabled(
        page >= totalPages - 1
      )
  );

  return row;
}

// ==================================================
// COMMANDS
// ==================================================

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Show bot status"
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Open KDBot help center"
    ),

  new SlashCommandBuilder()
    .setName("language")
    .setDescription(
      "Choose your language"
    )
    .addStringOption(
      option =>
        option
          .setName(
            "language"
          )
          .setDescription(
            "Choose a language"
          )
          .setRequired(
            true
          )
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
    .setDescription(
      "Delete messages"
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "amount"
          )
          .setDescription(
            "Number of messages"
          )
          .setRequired(
            false
          )
          .setMinValue(1)
          .setMaxValue(100)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription(
      "Kick a member"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "Reason"
          )
          .setRequired(
            false
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription(
      "Ban a member"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "time"
          )
          .setDescription(
            "Ban duration"
          )
          .setRequired(
            false
          )
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName(
            "unit"
          )
          .setDescription(
            "Time unit"
          )
          .setRequired(
            false
          )
          .addChoices(
            ...unitChoices()
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "Reason"
          )
          .setRequired(
            false
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription(
      "Unban a user"
    )
    .addStringOption(
      option =>
        option
          .setName(
            "userid"
          )
          .setDescription(
            "Discord User ID"
          )
          .setRequired(
            true
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription(
      "Timeout a member"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "time"
          )
          .setDescription(
            "Timeout duration"
          )
          .setRequired(
            true
          )
          .setMinValue(1)
    )
    .addStringOption(
      option =>
        option
          .setName(
            "unit"
          )
          .setDescription(
            "Time unit"
          )
          .setRequired(
            true
          )
          .addChoices(
            ...unitChoices()
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "Reason"
          )
          .setRequired(
            false
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription(
      "Remove a timeout"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription(
      "Warn a member"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "reason"
          )
          .setDescription(
            "Reason"
          )
          .setRequired(
            false
          )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription(
      "Remove a specific warning"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Member"
          )
          .setRequired(
            true
          )
    )
    .addIntegerOption(
      option =>
        option
          .setName(
            "warning"
          )
          .setDescription(
            "Warning number"
          )
          .setRequired(
            true
          )
          .setMinValue(1)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription(
      "Show server warnings"
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )
].map(
  command =>
    command.toJSON()
);

// ==================================================
// READY
// ==================================================

client.once(
  "clientReady",
  async () => {
    logSuccess(
      `Bot online as ${client.user.tag}`
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

      logSuccess(
        "Slash commands registered!"
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

      await checkSupabase();

      await loadTempBans();

      logSuccess(
        `Startup complete | Servers: ${client.guilds.cache.size} | Ping: ${client.ws.ping}ms`
      );

    } catch (error) {
      logError(
        "Startup error",
        error
      );
    }
  }
);

// ==================================================
// DISCORD CONNECTION MONITORING
// ==================================================

client.on(
  "error",
  error => {
    logError(
      "Discord client error",
      error
    );
  }
);

client.on(
  "warn",
  message => {
    logWarning(
      `Discord warning: ${message}`
    );
  }
);

client.on(
  "debug",
  message => {
    if (
      message
        .toLowerCase()
        .includes("rate limit")
    ) {
      logWarning(
        `Discord rate limit: ${message}`
      );
    }
  }
);

client.on(
  "shardDisconnect",
  (event, shardId) => {
    logWarning(
      `Discord shard ${shardId} disconnected. Code: ${event?.code}`
    );
  }
);

client.on(
  "shardReconnecting",
  shardId => {
    logWarning(
      `Discord shard ${shardId} reconnecting...`
    );
  }
);

client.on(
  "shardResume",
  (shardId, replayedEvents) => {
    logSuccess(
      `Discord shard ${shardId} resumed. Replayed events: ${replayedEvents}`
    );
  }
);

// ==================================================
// INTERACTIONS
// ==================================================

client.on(
  "interactionCreate",
  async interaction => {

    const started =
      Date.now();

    try {

      // ==================================================
      // WARNING PAGINATION BUTTONS
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "warnings_"
        )
      ) {
        const parts =
          interaction.customId.split(
            ":"
          );

        const action =
          parts[0];

        const ownerId =
          parts[1];

        const oldPage =
          Number(parts[2]);

        if (
          interaction.user.id !==
          ownerId
        ) {
          await interaction.reply({
            content:
              "❌ هذه الأزرار ليست لك.",
            ephemeral: true
          });

          return;
        }

        const language =
          await getLanguage(
            interaction
          );

        const {
          data,
          error
        } = await supabase
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
          logError(
            "Warnings pagination",
            error
          );

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ حدث خطأ أثناء تحديث صفحة التحذيرات."
                : "❌ Failed to update warnings page.",
            ephemeral: true
          });

          return;
        }

        const warnings =
          data || [];

        const totalPages =
          Math.max(
            1,
            Math.ceil(
              warnings.length /
                WARNINGS_PER_PAGE
            )
          );

        let newPage =
          oldPage;

        if (
          action ===
          "warnings_prev"
        ) {
          newPage =
            oldPage - 1;
        }

        if (
          action ===
          "warnings_next"
        ) {
          newPage =
            oldPage + 1;
        }

        newPage =
          Math.min(
            Math.max(
              newPage,
              0
            ),
            totalPages - 1
          );

        await interaction.update({
          embeds: [
            createWarningsEmbed(
              warnings,
              newPage,
              language,
              interaction.guild
            )
          ],
          components: [
            createWarningsButtons(
              newPage,
              totalPages,
              ownerId,
              language
            )
          ]
        });

        return;
      }

      // ==================================================
      // HELP BUTTONS
      // ==================================================

      if (
        interaction.isButton()
      ) {
        const map = {
          help_home: "home",
          help_info: "info",
          help_management:
            "management",
          help_fun: "fun",
          help_settings:
            "settings"
        };

        const section =
          map[
            interaction.customId
          ];

        if (!section) {
          return;
        }

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

      const commandName =
        interaction.commandName;

      logInfo(
        `Command /${commandName} used by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild?.name || "DM"}`
      );

      // ==================================================
      // LANGUAGE
      // ==================================================

      if (
        commandName ===
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
            newLanguage ===
            "ar"
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
        commandName ===
        "ping"
      ) {
        const ping =
          Math.round(
            client.ws.ping
          );

        const servers =
          client.guilds.cache.size;

        const users =
          client.guilds.cache.reduce(
            (
              total,
              guild
            ) =>
              total +
              guild.memberCount,
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
            .setColor(
              0x57F287
            )
            .setTitle(
              language ===
                "ar"
                ? "🟢 KDBot • حالة النظام"
                : "🟢 KDBot • System Status"
            )
            .setDescription(
              language ===
                "ar"
                ? "**🟢 البوت متصل ويعمل بشكل طبيعي**"
                : "**🟢 Bot is online and running normally**"
            )
            .addFields(
              {
                name:
                  language ===
                    "ar"
                    ? "🏓 سرعة الاستجابة"
                    : "🏓 Response Time",

                value:
                  `\`${ping}ms\``,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "💻 السيرفرات"
                    : "💻 Servers",

                value:
                  `\`${servers}\``,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "👥 المستخدمون"
                    : "👥 Users",

                value:
                  `\`${users.toLocaleString()}\``,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "⏱️ مدة التشغيل"
                    : "⏱️ Uptime",

                value:
                  `\`${uptime}\``,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "📡 حالة Discord"
                    : "📡 Discord Status",

                value:
                  language ===
                    "ar"
                    ? "🟢 متصل"
                    : "🟢 Online",

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
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
          embeds: [
            embed
          ]
        });

        return;
      }

      // ==================================================
      // HELP
      // ==================================================

      if (
        commandName ===
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
        commandName ===
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
              language ===
                "ar"
                ? `🧹 تم حذف **${deleted.size}** رسالة.`
                : `🧹 Deleted **${deleted.size}** messages.`,

            ephemeral: true
          });

        } catch (error) {
          logError(
            "Clear messages",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
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
            language ===
              "ar"
              ? "بدون سبب"
              : "No reason provided"
          );

        const member =
          await interaction.guild.members
            .fetch(
              user.id
            )
            .catch(
              () => null
            );

        if (
          !member ||
          !member.kickable
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ لا أستطيع طرد هذا العضو."
                : "❌ I cannot kick this member.",

            ephemeral: true
          });

          return;
        }

        try {
          await member.kick(
            reason
          );

          await interaction.reply({
            content:
              language ===
                "ar"
                ? `👢 تم طرد **${user.tag}**.\n📝 ${reason}`
                : `👢 **${user.tag}** was kicked.\n📝 ${reason}`
          });

        } catch (error) {
          logError(
            "Kick",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
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
            language ===
              "ar"
              ? "بدون سبب"
              : "No reason provided"
          );

        if (
          time &&
          !unit
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
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
                Date.now() +
                  duration
              ).toISOString();

            const {
              data,
              error
            } = await supabase
              .from(
                "tempbans"
              )
              .insert({
                guild_id:
                  interaction
                    .guild
                    .id,

                user_id:
                  user.id,

                username:
                  user.username,

                expires_at:
                  expiresAt,

                moderator_id:
                  interaction
                    .user
                    .id
              })
              .select()
              .single();

            if (error) {
              logError(
                "Tempban save",
                error
              );
            } else {
              await scheduleTempBan(
                data
              );
            }

            await interaction.reply({
              content:
                language ===
                  "ar"
                  ? `🔨 تم حظر **${user.tag}** لمدة **${time} ${unit}**.`
                  : `🔨 **${user.tag}** was banned for **${time} ${unit}**.`
            });

          } else {
            await interaction.reply({
              content:
                language ===
                  "ar"
                  ? `🔨 تم حظر **${user.tag}** بشكل دائم.`
                  : `🔨 **${user.tag}** was permanently banned.`
            });
          }

        } catch (error) {
          logError(
            "Ban",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
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

          const {
            error
          } = await supabase
            .from(
              "tempbans"
            )
            .delete()
            .eq(
              "guild_id",
              interaction
                .guild
                .id
            )
            .eq(
              "user_id",
              userId
            );

          if (error) {
            logError(
              "Tempban delete on unban",
              error
            );
          }

          await interaction.reply({
            content:
              language ===
                "ar"
                ? `🔓 تم فك حظر <@${userId}>.`
                : `🔓 <@${userId}> has been unbanned.`
          });

        } catch (error) {
          logError(
            "Unban",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
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
            language ===
              "ar"
              ? "بدون سبب"
              : "No reason provided"
          );

        const member =
          await interaction.guild.members
            .fetch(
              user.id
            )
            .catch(
              () => null
            );

        if (
          !member ||
          !member.moderatable
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
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
              language ===
                "ar"
                ? `⏱️ تم إعطاء **${user.tag}** Timeout لمدة **${time} ${unit}**.`
                : `⏱️ **${user.tag}** was timed out for **${time} ${unit}**.`
          });

        } catch (error) {
          logError(
            "Timeout",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
        "untimeout"
      ) {
        const user =
          interaction.options.getUser(
            "user"
          );

        const member =
          await interaction.guild.members
            .fetch(
              user.id
            )
            .catch(
              () => null
            );

        if (!member) {
          await interaction.reply({
            content:
              language ===
                "ar"
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
              language ===
                "ar"
                ? `🔄 تم إزالة Timeout عن **${user.tag}**.`
                : `🔄 Timeout removed from **${user.tag}**.`
          });

        } catch (error) {
          logError(
            "Untimeout",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
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
        commandName ===
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
            language ===
              "ar"
              ? "بدون سبب"
              : "No reason provided"
          );

        const existingWarnings =
          await getUserWarnings(
            interaction
              .guild
              .id,
            user.id
          );

        if (
          existingWarnings ===
          null
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ حدث خطأ أثناء جلب التحذيرات."
                : "❌ An error occurred while checking warnings.",

            ephemeral: true
          });

          return;
        }

        const warningNumber =
          existingWarnings.length +
          1;

        const {
          data: warningData,
          error
        } = await supabase
          .from(
            "warnings"
          )
          .insert({
            guild_id:
              interaction
                .guild
                .id,

            user_id:
              user.id,

            username:
              user.username,

            reason,

            moderator_id:
              interaction
                .user
                .id
          })
          .select(
            "id, created_at"
          )
          .single();

        if (error) {
          logError(
            "Warning save",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ لم أتمكن من حفظ التحذير."
                : "❌ I couldn't save the warning.",

            ephemeral: true
          });

          return;
        }

        const warningTime =
          formatWarningDate(
            warningData?.created_at,
            language
          );

        const embed =
          new EmbedBuilder()
            .setColor(
              0xF1C40F
            )
            .setTitle(
              language ===
                "ar"
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
                  language ===
                    "ar"
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
                  language ===
                    "ar"
                    ? "🆔 المعرّف"
                    : "🆔 User ID",

                value:
                  `\`${user.id}\``,

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "📝 السبب"
                    : "📝 Reason",

                value:
                  reason,

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "🕐 التاريخ والوقت"
                    : "🕐 Date & Time",

                value:
                  warningTime,

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "👮 المشرف"
                    : "👮 Moderator",

                value:
                  `<@${interaction.user.id}>`,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "🔢 رقم التحذير"
                    : "🔢 Warning #",

                value:
                  `\`${warningNumber}\``,

                inline: true
              }
            )
            .setFooter({
              text:
                language ===
                  "ar"
                  ? `السيرفر: ${interaction.guild.name}`
                  : `Server: ${interaction.guild.name}`
            })
            .setTimestamp();

        await interaction.reply({
          embeds: [
            embed
          ]
        });

        return;
      }

      // ==================================================
      // UNWARN
      // ==================================================

      if (
        commandName ===
        "unwarn"
      ) {
        const user =
          interaction.options.getUser(
            "user"
          );

        const warningNumber =
          interaction.options.getInteger(
            "warning"
          );

        const warnings =
          await getUserWarnings(
            interaction
              .guild
              .id,
            user.id
          );

        if (
          warnings ===
          null
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ حدث خطأ أثناء جلب التحذيرات."
                : "❌ An error occurred while loading warnings.",

            ephemeral: true
          });

          return;
        }

        if (
          warnings.length ===
          0
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ هذا العضو لا يملك تحذيرات."
                : "❌ This member has no warnings.",

            ephemeral: true
          });

          return;
        }

        if (
          warningNumber >
            warnings.length
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? `❌ رقم التحذير غير موجود. لدى العضو **${warnings.length}** تحذير فقط.`
                : `❌ That warning does not exist. The member has only **${warnings.length}** warnings.`,

            ephemeral: true
          });

          return;
        }

        // الأرقام مرتبة من الأقدم إلى الأحدث:
        // #1 = أول تحذير
        // #2 = ثاني تحذير
        // وهكذا
        const warning =
          warnings[
            warningNumber - 1
          ];

        const {
          error: deleteError
        } = await supabase
          .from(
            "warnings"
          )
          .delete()
          .eq(
            "id",
            warning.id
          )
          .eq(
            "guild_id",
            interaction
              .guild
              .id
          );

        if (
          deleteError
        ) {
          logError(
            "Warning delete",
            deleteError
          );

          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ لم أتمكن من إزالة التحذير."
                : "❌ I couldn't remove the warning.",

            ephemeral: true
          });

          return;
        }

        const embed =
          new EmbedBuilder()
            .setColor(
              0x2ECC71
            )
            .setTitle(
              language ===
                "ar"
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
                  language ===
                    "ar"
                    ? "👤 العضو"
                    : "👤 Member",

                value:
                  `${user.globalName || user.username} (@${user.username})`,

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "🔢 رقم التحذير"
                    : "🔢 Warning #",

                value:
                  `\`${warningNumber}\``,

                inline: true
              },
              {
                name:
                  language ===
                    "ar"
                    ? "📝 سبب التحذير"
                    : "📝 Warning Reason",

                value:
                  warning.reason ||
                  (
                    language ===
                      "ar"
                      ? "بدون سبب"
                      : "No reason"
                  ),

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "🕐 تاريخ التحذير"
                    : "🕐 Warning Date",

                value:
                  formatWarningDate(
                    warning.created_at,
                    language
                  ),

                inline: false
              },
              {
                name:
                  language ===
                    "ar"
                    ? "👮 أزال التحذير"
                    : "👮 Removed By",

                value:
                  `<@${interaction.user.id}>`,

                inline: true
              }
            )
            .setTimestamp();

        await interaction.reply({
          embeds: [
            embed
          ]
        });

        return;
      }

      // ==================================================
      // WARNINGS
      // ==================================================

      if (
        commandName ===
        "warnings"
      ) {
        const {
          data,
          error
        } = await supabase
          .from(
            "warnings"
          )
          .select(
            "id, user_id, username, reason, moderator_id, created_at"
          )
          .eq(
            "guild_id",
            interaction
              .guild
              .id
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          );

        if (error) {
          logError(
            "Warnings",
            error
          );

          await interaction.reply({
            content:
              language ===
                "ar"
                ? "❌ لم أتمكن من جلب التحذيرات."
                : "❌ I couldn't load the warnings.",

            ephemeral: true
          });

          return;
        }

        const warnings =
          data || [];

        if (
          warnings.length ===
          0
        ) {
          await interaction.reply({
            content:
              language ===
                "ar"
                ? "✅ لا توجد تحذيرات في هذا السيرفر."
                : "✅ There are no warnings in this server.",

            ephemeral: true
          });

          return;
        }

        const totalPages =
          Math.ceil(
            warnings.length /
              WARNINGS_PER_PAGE
          );

        const page = 0;

        await interaction.reply({
          embeds: [
            createWarningsEmbed(
              warnings,
              page,
              language,
              interaction.guild
            )
          ],

          components: [
            createWarningsButtons(
              page,
              totalPages,
              interaction.user.id,
              language
            )
          ]
        });

        return;
      }

    } catch (error) {

      logError(
        `Unhandled interaction error (${interaction.commandName || interaction.customId || "unknown"})`,
        error
      );

      try {
        const message =
          "❌ حدث خطأ غير متوقع أثناء تنفيذ العملية. تم تسجيل الخطأ في الـ Console.";

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              message,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content:
              message,
            ephemeral: true
          });
        }
      } catch (replyError) {
        logError(
          "Could not send error response",
          replyError
        );
      }

    } finally {

      const duration =
        Date.now() -
        started;

      if (
        duration >
        3000
      ) {
        logWarning(
          `Slow interaction: ${interaction.commandName || interaction.customId || "unknown"} took ${duration}ms`
        );
      } else {
        logInfo(
          `Interaction completed in ${duration}ms`
        );
      }
    }
  }
);

// ==================================================
// GLOBAL ERROR HANDLERS
// ==================================================

process.on(
  "unhandledRejection",
  error => {
    logError(
      "Unhandled Promise Rejection",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    logError(
      "Uncaught Exception",
      error
    );
  }
);

// ==================================================
// GRACEFUL SHUTDOWN
// ==================================================

async function shutdown(
  signal
) {
  logWarning(
    `Received ${signal}. Shutting down safely...`
  );

  for (
    const timer of
    tempBanTimers.values()
  ) {
    clearTimeout(
      timer
    );
  }

  tempBanTimers.clear();

  try {
    client.destroy();

    logSuccess(
      "Bot shutdown complete."
    );

    process.exit(0);
  } catch (error) {
    logError(
      "Shutdown error",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
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
  .then(
    async response => {
      console.log(
        "🌐 Discord API status:",
        response.status
      );

      const text =
        await response.text();

      if (
        response.status ===
        429
      ) {
        logWarning(
          "Discord API returned 429. You are temporarily rate limited."
        );

        console.log(
          "🌐 Discord API response:",
          text
        );

      } else if (
        response.ok
      ) {
        console.log(
          "🌐 Discord API response:",
          text
        );

      } else {
        logWarning(
          `Discord API returned HTTP ${response.status}`
        );

        console.log(
          "🌐 Discord API response:",
          text
        );
      }

      console.log(
        "🚀 Attempting Discord login..."
      );

      return client.login(
        DISCORD_TOKEN
      );
    }
  )
  .then(
    () => {
      logSuccess(
        "Discord login successful!"
      );
    }
  )
  .catch(
    error => {
      logError(
        "Discord connection/login failed",
        error
      );

      process.exit(1);
    }
  );

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

// ====================
// Environment
// ====================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase environment variables are missing!");
  process.exit(1);
}

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing!");
  process.exit(1);
}

// ====================
// Supabase
// ====================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ====================
// Discord Client
// ====================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ====================
// Language Cache
// ====================

const userLanguages = new Map();
const guildLanguages = new Map();

// ====================
// Supabase Test
// ====================

async function testSupabase() {

  console.log(
    "Supabase URL exists:",
    !!SUPABASE_URL
  );

  console.log(
    "Supabase Key exists:",
    !!SUPABASE_KEY
  );

  const { data, error } = await supabase
    .from("test")
    .select("id")
    .limit(1);

  if (error) {

    console.log(
      "❌ Supabase error:",
      error.message
    );

  } else {

    console.log(
      "✅ Supabase connected:",
      data
    );
  }
}

testSupabase();

// ====================
// Save User
// ====================

async function saveUser(interaction, language) {

  const discordId = interaction.user.id;
  const username = interaction.user.username;

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("discord_id", discordId)
    .limit(1);

  if (error) {

    console.log(
      "❌ User lookup error:",
      error.message
    );

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
        .eq(
          "discord_id",
          discordId
        );

    if (updateError) {

      console.log(
        "❌ User update error:",
        updateError.message
      );
    }

    return;
  }

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
      "❌ User insert error:",
      insertError.message
    );

  } else {

    console.log(
      `✅ User saved: ${username}`
    );
  }
}

// ====================
// Save Guild
// ====================

async function saveGuild(
  guild,
  language = "ar"
) {

  if (!guild) return;

  const { data, error } =
    await supabase
      .from("guilds")
      .select("id")
      .eq(
        "guild_id",
        guild.id
      )
      .limit(1);

  if (error) {

    console.log(
      `❌ Guild lookup error (${guild.name}):`,
      error.message
    );

    return;
  }

  if (data && data.length > 0) {

    guildLanguages.set(
      guild.id,
      language
    );

    return;
  }

  const { error: insertError } =
    await supabase
      .from("guilds")
      .insert({
        guild_id: guild.id,
        language
      });

  if (insertError) {

    console.log(
      `❌ Guild insert error (${guild.name}):`,
      insertError.message
    );

  } else {

    guildLanguages.set(
      guild.id,
      language
    );

    console.log(
      `✅ Guild saved: ${guild.name}`
    );
  }
}

// ====================
// Get Guild Language
// ====================

async function getGuildLanguage(guild) {

  if (!guild) return "en";

  if (
    guildLanguages.has(guild.id)
  ) {

    return guildLanguages.get(
      guild.id
    );
  }

  const { data, error } =
    await supabase
      .from("guilds")
      .select("language")
      .eq(
        "guild_id",
        guild.id
      )
      .limit(1);

  if (
    !error &&
    data &&
    data.length > 0
  ) {

    const language =
      data[0].language === "en"
        ? "en"
        : "ar";

    guildLanguages.set(
      guild.id,
      language
    );

    return language;
  }

  const locale =
    guild.preferredLocale ||
    "en-US";

  const language =
    locale
      .toLowerCase()
      .startsWith("ar")
      ? "ar"
      : "en";

  await saveGuild(
    guild,
    language
  );

  return language;
}

// ====================
// Get User Language
// ====================

async function getLanguage(
  interaction
) {

  const userId =
    interaction.user.id;

  if (
    userLanguages.has(userId)
  ) {

    return userLanguages.get(
      userId
    );
  }

  const { data, error } =
    await supabase
      .from("users")
      .select("language")
      .eq(
        "discord_id",
        userId
      )
      .limit(1);

  if (
    !error &&
    data &&
    data.length > 0
  ) {

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

  let language = "en";

  if (interaction.guild) {

    language =
      await getGuildLanguage(
        interaction.guild
      );

  } else {

    const locale =
      interaction.locale ||
      "en-US";

    language =
      locale
        .toLowerCase()
        .startsWith("ar")
        ? "ar"
        : "en";
  }

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

// ====================
// Commands
// ====================

const commands = [

  // PING

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Show bot status"
    ),

  // HELP

  new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Open help center"
    ),

  // LANGUAGE

  new SlashCommandBuilder()
    .setName("language")
    .setDescription(
      "Change your language"
    )
    .addStringOption(option =>
      option
        .setName("language")
        .setDescription(
          "Choose your language"
        )
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
    .setDescription(
      "Delete messages"
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription(
          "Number of messages (default: 10)"
        )
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
    .setDescription(
      "Kick a member"
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "Member to kick"
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription(
          "Reason"
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  // BAN

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription(
      "Ban a member"
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "Member to ban"
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription(
          "Reason"
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  // UNBAN

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription(
      "Unban a user"
    )
    .addStringOption(option =>
      option
        .setName("userid")
        .setDescription(
          "Discord User ID"
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  // TIMEOUT

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription(
      "Timeout a member"
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "Member to timeout"
        )
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription(
          "Timeout duration in minutes"
        )
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription(
          "Reason"
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  // WARN

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription(
      "Warn a member"
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "Member to warn"
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription(
          "Reason"
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

].map(command =>
  command.toJSON()
);
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

  if (seconds || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

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
          "## 👋 أهلاً بك في KDBot\n\n" +
          "اختر القسم الذي تريد استعراض أوامره من الأزرار بالأسفل."
        )
        .addFields(
          {
            name: "📊 ┃ المعلومات",
            value: "معلومات البوت وحالته",
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
          text: "KDBot • مركز المساعدة"
        })
        .setTimestamp();
    }

    if (section === "info") {

      return new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📊 KDBot • المعلومات")
        .setDescription(
          "## 📊 أوامر المعلومات\n\n" +
          "الأوامر الخاصة بمعلومات وحالة البوت."
        )
        .addFields({
          name: "🏓 `/ping`",
          value:
            "عرض حالة البوت، سرعة الاستجابة، عدد السيرفرات، المستخدمين ومدة التشغيل.",
          inline: false
        })
        .setFooter({
          text: "KDBot • المعلومات"
        });
    }

    if (section === "management") {

      return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("🛠️ KDBot • الإدارة")
        .setDescription(
          "## 🛠️ أوامر الإدارة\n\n" +
          "أوامر إدارة ومراقبة السيرفر."
        )
        .addFields(
          {
            name: "🧹 `/clear`",
            value:
              "حذف الرسائل. بدون تحديد عدد يحذف آخر 10 رسائل.",
            inline: false
          },
          {
            name: "👢 `/kick`",
            value:
              "طرد عضو من السيرفر.",
            inline: false
          },
          {
            name: "🔨 `/ban`",
            value:
              "حظر عضو من السيرفر.",
            inline: false
          },
          {
            name: "🔓 `/unban`",
            value:
              "فك حظر مستخدم باستخدام Discord ID.",
            inline: false
          },
          {
            name: "⏱️ `/timeout`",
            value:
              "إعطاء عضو Timeout لمدة محددة.",
            inline: false
          },
          {
            name: "⚠️ `/warn`",
            value:
              "إرسال تحذير لعضو.",
            inline: false
          }
        )
        .setFooter({
          text: "KDBot • الإدارة"
        });
    }

    if (section === "fun") {

      return new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🎮 KDBot • الترفيه")
        .setDescription(
          "## 🎮 أوامر الترفيه\n\n" +
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
        .setTitle("⚙️ KDBot • الإعدادات")
        .setDescription(
          "## ⚙️ الإعدادات\n\n" +
          "🚧 **قريباً**\n" +
          "سيتم إضافة إعدادات البوت هنا."
        )
        .setFooter({
          text: "KDBot • الإعدادات"
        });
    }
  }

  // ====================
  // English
  // ====================

  if (section === "home") {

    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("✨ KDBot • Help Center")
      .setDescription(
        "## 👋 Welcome to KDBot\n\n" +
        "Choose a category below to explore its commands."
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
          value: "Fun and entertainment commands",
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
        "## 📊 Information Commands\n\n" +
        "Commands for bot information and status."
      )
      .addFields({
        name: "🏓 `/ping`",
        value:
          "Show bot status, latency, servers, users and uptime.",
        inline: false
      })
      .setFooter({
        text: "KDBot • Information"
      });
  }

  if (section === "management") {

    return new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("🛠️ KDBot • Management")
      .setDescription(
        "## 🛠️ Management Commands\n\n" +
        "Commands for managing and moderating the server."
      )
      .addFields(
        {
          name: "🧹 `/clear`",
          value:
            "Delete messages. Without an amount, the last 10 messages are deleted.",
          inline: false
        },
        {
          name: "👢 `/kick`",
          value:
            "Kick a member from the server.",
          inline: false
        },
        {
          name: "🔨 `/ban`",
          value:
            "Ban a member from the server.",
          inline: false
        },
        {
          name: "🔓 `/unban`",
          value:
            "Unban a user using their Discord ID.",
          inline: false
        },
        {
          name: "⏱️ `/timeout`",
          value:
            "Timeout a member for a selected duration.",
          inline: false
        },
        {
          name: "⚠️ `/warn`",
          value:
            "Warn a member.",
          inline: false
        }
      )
      .setFooter({
        text: "KDBot • Management"
      });
  }

  if (section === "fun") {

    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle("🎮 KDBot • Fun")
      .setDescription(
        "## 🎮 Fun Commands\n\n" +
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
      .setTitle("⚙️ KDBot • Settings")
      .setDescription(
        "## ⚙️ Settings\n\n" +
        "🚧 **Coming Soon**\n" +
        "Bot settings will be added here."
      )
      .setFooter({
        text: "KDBot • Settings"
      });
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

    } catch (error) {

      console.error(
        "❌ Startup error:",
        error.message
      );
    }
  }
);

// ====================
// New Guild
// ====================

client.on(
  "guildCreate",
  async guild => {

    console.log(
      `📥 Joined guild: ${guild.name}`
    );

    await saveGuild(
      guild,
      "ar"
    );
  }
);

// ====================
// Interactions
// ====================

client.on(
  "interactionCreate",
  async interaction => {

    // ====================
    // Slash Commands
    // ====================

    if (
      interaction.isChatInputCommand()
    ) {

      const language =
        await getLanguage(
          interaction
        );

      // ====================
      // LANGUAGE
      // ====================

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

        if (
          newLanguage === "ar"
        ) {

          await interaction.reply({
            content:
              "✅ تم تغيير لغة KDBot إلى **العربية** 🇮🇶",
            ephemeral: true
          });

        } else {

          await interaction.reply({
            content:
              "✅ KDBot language changed to **English** 🇬🇧",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // PING
      // ====================

      if (
        interaction.commandName ===
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

        let embed;

        if (
          language === "ar"
        ) {

          embed =
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle(
                "🟢 KDBot • حالة النظام"
              )
              .setDescription(
                "## 🟢 البوت متصل ويعمل بشكل طبيعي"
              )
              .addFields(
                {
                  name:
                    "🏓 سرعة الاستجابة",
                  value:
                    `### \`${ping}ms\``,
                  inline: true
                },
                {
                  name:
                    "💻 السيرفرات",
                  value:
                    `### \`${servers}\``,
                  inline: true
                },
                {
                  name:
                    "👥 المستخدمون",
                  value:
                    `### \`${users.toLocaleString()}\``,
                  inline: true
                },
                {
                  name:
                    "⏱️ مدة التشغيل",
                  value:
                    `\`${uptime}\``,
                  inline: true
                },
                {
                  name:
                    "📡 حالة Discord",
                  value:
                    "🟢 `متصل`",
                  inline: true
                },
                {
                  name:
                    "⚙️ الإصدار",
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

        } else {

          embed =
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle(
                "🟢 KDBot • System Status"
              )
              .setDescription(
                "## 🟢 Bot is online and running normally"
              )
              .addFields(
                {
                  name:
                    "🏓 Response Time",
                  value:
                    `### \`${ping}ms\``,
                  inline: true
                },
                {
                  name:
                    "💻 Servers",
                  value:
                    `### \`${servers}\``,
                  inline: true
                },
                {
                  name:
                    "👥 Users",
                  value:
                    `### \`${users.toLocaleString()}\``,
                  inline: true
                },
                {
                  name:
                    "⏱️ Uptime",
                  value:
                    `\`${uptime}\``,
                  inline: true
                },
                {
                  name:
                    "📡 Discord Status",
                  value:
                    "🟢 `Online`",
                  inline: true
                },
                {
                  name:
                    "⚙️ Version",
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
        }

        await interaction.reply({
          embeds: [embed]
        });

        return;
      }

      // ====================
      // HELP
      // ====================

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

      // ====================
      // CLEAR
      // ====================

      if (
        interaction.commandName ===
        "clear"
      ) {

        const amount =
          interaction.options.getInteger(
            "amount"
          ) || 10;

        if (
          !interaction.channel ||
          !interaction.channel.isTextBased()
        ) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لا يمكن استخدام هذا الأمر هنا."
                : "❌ This command cannot be used here.",
            ephemeral: true
          });

          return;
        }

        try {

          const deleted =
            await interaction.channel.bulkDelete(
              amount,
              true
            );

          if (
            language === "ar"
          ) {

            await interaction.reply({
              content:
                `🧹 تم حذف **${deleted.size}** رسالة بنجاح.`,
              ephemeral: true
            });

          } else {

            await interaction.reply({
              content:
                `🧹 Successfully deleted **${deleted.size}** messages.`,
              ephemeral: true
            });
          }

        } catch (error) {

          console.error(
            "❌ Clear error:",
            error.message
          );

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لم أتمكن من حذف الرسائل. تأكد أن لدي صلاحية **إدارة الرسائل**."
                : "❌ I couldn't delete the messages. Make sure I have **Manage Messages** permission.",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // KICK
      // ====================

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

        if (!member) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ هذا العضو غير موجود في السيرفر."
                : "❌ This member is not in the server.",
            ephemeral: true
          });

          return;
        }

        if (!member.kickable) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لا أستطيع طرد هذا العضو. تأكد من صلاحياتي وترتيب الرتب."
                : "❌ I cannot kick this member. Check my permissions and role hierarchy.",
            ephemeral: true
          });

          return;
        }

        try {

          await member.kick(reason);

          await interaction.reply({
            content:
              language === "ar"
                ? `👢 تم طرد **${user.tag}** بنجاح.\n📝 السبب: ${reason}`
                : `👢 **${user.tag}** was kicked successfully.\n📝 Reason: ${reason}`
          });

        } catch (error) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ حدث خطأ أثناء طرد العضو."
                : "❌ An error occurred while kicking the member.",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // BAN
      // ====================

      if (
        interaction.commandName ===
        "ban"
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
          member &&
          !member.bannable
        ) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لا أستطيع حظر هذا العضو."
                : "❌ I cannot ban this member.",
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

          await interaction.reply({
            content:
              language === "ar"
                ? `🔨 تم حظر **${user.tag}** بنجاح.\n📝 السبب: ${reason}`
                : `🔨 **${user.tag}** was banned successfully.\n📝 Reason: ${reason}`
          });

        } catch (error) {

          console.error(
            "❌ Ban error:",
            error.message
          );

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ حدث خطأ أثناء حظر العضو."
                : "❌ An error occurred while banning the member.",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // UNBAN
      // ====================

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

          await interaction.reply({
            content:
              language === "ar"
                ? `🔓 تم فك حظر المستخدم بنجاح.\n🆔 ${userId}`
                : `🔓 User was unbanned successfully.\n🆔 ${userId}`
          });

        } catch (error) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لم أتمكن من فك الحظر. تأكد من أن الـ ID صحيح وأن المستخدم محظور."
                : "❌ I couldn't unban this user. Make sure the ID is correct and the user is banned.",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // TIMEOUT
      // ====================

      if (
        interaction.commandName ===
        "timeout"
      ) {

        const user =
          interaction.options.getUser(
            "user"
          );

        const minutes =
          interaction.options.getInteger(
            "minutes"
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

        if (!member.moderatable) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ لا أستطيع إعطاء هذا العضو Timeout."
                : "❌ I cannot timeout this member.",
            ephemeral: true
          });

          return;
        }

        try {

          await member.timeout(
            minutes * 60 * 1000,
            reason
          );

          await interaction.reply({
            content:
              language === "ar"
                ? `⏱️ تم إعطاء **${user.tag}** Timeout لمدة **${minutes} دقيقة**.\n📝 السبب: ${reason}`
                : `⏱️ **${user.tag}** has been timed out for **${minutes} minutes**.\n📝 Reason: ${reason}`
          });

        } catch (error) {

          await interaction.reply({
            content:
              language === "ar"
                ? "❌ حدث خطأ أثناء إعطاء Timeout."
                : "❌ An error occurred while applying the timeout.",
            ephemeral: true
          });
        }

        return;
      }

      // ====================
      // WARN
      // ====================

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

        if (
          language === "ar"
        ) {

          await interaction.reply({
            content:
              `⚠️ تم تحذير **${user.tag}**.\n📝 السبب: ${reason}`
          });

        } else {

          await interaction.reply({
            content:
              `⚠️ **${user.tag}** has been warned.\n📝 Reason: ${reason}`
          });
        }

        return;
      }
    }

    // ====================
    // HELP BUTTONS
    // ====================

    if (
      interaction.isButton()
    ) {

      const sectionMap = {

        help_home: "home",
        help_info: "info",
        help_management:
          "management",
        help_fun: "fun",
        help_settings:
          "settings"

      };

      const section =
        sectionMap[
          interaction.customId
        ];

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
  }
);

// ====================
// Login
// ====================

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

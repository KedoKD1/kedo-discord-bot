const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

// HOME
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  res.sendFile(__dirname + "/public/dashboard.html");
});

// DISCORD LOGIN
app.get("/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send("Discord OAuth2 is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify guilds"
  });

  res.redirect(
    `https://discord.com/oauth2/authorize?${params}`
  );
});

// CALLBACK
app.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing Discord OAuth2 code.");
  }

  try {
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      }
    );

    if (!tokenResponse.ok) {
      return res.status(502).send("Discord OAuth2 token exchange failed.");
    }

    const tokens = await tokenResponse.json();

    const headers = {
      Authorization: `${tokens.token_type} ${tokens.access_token}`
    };

    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      { headers }
    );

    const guildResponse = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      { headers }
    );

    if (!userResponse.ok || !guildResponse.ok) {
      return res.status(502).send("Failed to load Discord account.");
    }

    req.session.user = await userResponse.json();
    req.session.guilds = await guildResponse.json();

    res.redirect("/dashboard");

  } catch (error) {
    console.error("OAuth2 Error:", error);
    res.status(500).send("Discord authentication failed.");
  }
});

// CURRENT USER
app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({
      loggedIn: false
    });
  }

  res.json({
    loggedIn: true,
    user: req.session.user,
    guilds: req.session.guilds || []
  });
});

// BOT STATUS
app.get("/api/status", (req, res) => {
  const bot = global.kdbot;

  res.json({
    online: !!bot?.user,
    bot: bot?.user?.username || "KDBot",
    version: "1.0.0",
    servers: bot?.guilds?.cache?.size || 0,
    ping: bot?.ws?.ping || 0
  });
});

// LOGOUT
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
});

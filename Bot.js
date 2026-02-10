import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import time
import datetime
import aiohttp
import os
import pathlib

# ======================
# CONFIG
# ======================

TOKEN = os.getenv("TOKEN")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")

OWNER_ID = 1158155824548556873
OWNERSHIP_ROLE_ID = 1442689932316381267
MOD_ROLE_ID = 1442689963240984599


# ======================
# INTENTS
# ======================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True


# ======================
# DATABASE (RAILWAY VOLUME)
# ======================

DATA_DIR = "/app/data"
pathlib.Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "levels.db")

db = sqlite3.connect(DB_PATH)
cursor = db.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
  guild_id INTEGER,
  user_id INTEGER,
  xp INTEGER,
  level INTEGER,
  PRIMARY KEY (guild_id, user_id)
)
""")

db.commit()


# ======================
# BOT CLASS
# ======================

class MyBot(commands.Bot):

    def __init__(self):
        super().__init__(command_prefix="$", intents=intents, help_command=None)

        self.start_time = time.time()

        self.webhook_secret = WEBHOOK_SECRET

        self.stream_url = "https://txrp-utilities.lovable.app/"
        self.current_activity_name = "TXRP Code:XFjOS | $help for commands"
        self.current_status = discord.Status.dnd


    async def update_web_status(self, is_online: bool):

        if not self.webhook_secret:
            return

        url = "https://joeuausysodgfannjzwp.supabase.co/functions/v1/bot-status"

        headers = {
            "Content-Type": "application/json",
            "x-webhook-secret": self.webhook_secret
        }

        data = {"is_online": is_online}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=data) as r:

                    if r.status == 200:
                        print("Web status updated")
                    else:
                        print("Webhook error:", r.status)

        except Exception as e:
            print("Webhook error:", e)


    async def setup_hook(self):
        await self.tree.sync()
        print("Slash commands synced")


    async def on_ready(self):

        await self.change_presence(
            status=self.current_status,
            activity=discord.Streaming(
                name=self.current_activity_name,
                url=self.stream_url
            )
        )

        await self.update_web_status(True)

        print(f"{self.user} is online")


bot = MyBot()


# ======================
# OWNER COMMANDS (DM)
# ======================

@bot.command()
async def setstatus(ctx, *, text: str):

    if ctx.author.id != OWNER_ID:
        return

    if ctx.guild:
        await ctx.author.send("❌ Use in DMs only.")
        return


    bot.current_activity_name = text

    await bot.change_presence(
        status=bot.current_status,
        activity=discord.Streaming(
            name=text,
            url=bot.stream_url
        )
    )

    await ctx.send("✅ Status updated")


@bot.command()
async def seturl(ctx, url: str):

    if ctx.author.id != OWNER_ID:
        return

    if ctx.guild:
        await ctx.author.send("❌ Use in DMs only.")
        return


    bot.stream_url = url

    await bot.change_presence(
        status=bot.current_status,
        activity=discord.Streaming(
            name=bot.current_activity_name,
            url=url
        )
    )

    await ctx.send("✅ URL updated")


@bot.command()
async def setpresence(ctx, mode: str):

    if ctx.author.id != OWNER_ID:
        return

    if ctx.guild:
        await ctx.author.send("❌ Use in DMs only.")
        return


    modes = {
        "online": discord.Status.online,
        "idle": discord.Status.idle,
        "dnd": discord.Status.dnd
    }

    new = modes.get(mode.lower())

    if not new:
        await ctx.send("❌ Use: online / idle / dnd")
        return


    bot.current_status = new

    await bot.change_presence(
        status=new,
        activity=discord.Streaming(
            name=bot.current_activity_name,
            url=bot.stream_url
        )
    )

    await ctx.send("✅ Presence updated")


@bot.command()
async def shutdown(ctx):

    if ctx.author.id != OWNER_ID:
        return

    if ctx.guild:
        await ctx.author.send("❌ Use in DMs only.")
        return


    await ctx.send("📴 Shutting down...")

    await bot.update_web_status(False)

    await bot.close()


# ======================
# STAFF SLASH COMMAND
# ======================

@bot.tree.command(
    name="embed",
    description="Create staff embed"
)
@app_commands.describe(
    title="Title",
    description="Message",
    color="Hex color"
)
async def embed_cmd(
    interaction: discord.Interaction,
    title: str,
    description: str,
    color: str = "#7d2ae8"
):

    if not any(
        r.id in [MOD_ROLE_ID, OWNERSHIP_ROLE_ID]
        for r in interaction.user.roles
    ):
        return await interaction.response.send_message(
            "❌ No permission",
            ephemeral=True
        )


    try:
        clean = int(color.replace("#", ""), 16)
    except:
        clean = 0x7d2ae8


    emb = discord.Embed(
        title=title,
        description=description,
        color=clean
    )

    emb.timestamp = datetime.datetime.utcnow()

    emb.set_footer(
        text="Texas State Roleplay Utilities Bot"
    )


    await interaction.channel.send(embed=emb)

    await interaction.response.send_message(
        "Embed sent",
        ephemeral=True
    )


# ======================
# USER COMMANDS
# ======================

@bot.command()
async def rank(ctx, member: discord.Member = None):

    if not ctx.guild:
        return

    member = member or ctx.author

    cursor.execute(
        "SELECT xp, level FROM users WHERE guild_id=? AND user_id=?",
        (ctx.guild.id, member.id)
    )

    row = cursor.fetchone()

    if not row:
        await ctx.send("❌ No XP data")
        return

    await ctx.send(
        f"📊 {member.name} | Level {row[1]} | XP {row[0]}"
    )


@bot.command()
async def link(ctx):

    await ctx.send(
        "🔗 https://txrp-utilities.lovable.app/"
    )


@bot.command()
async def pong(ctx):

    await ctx.send(
        f"🏓 {round(bot.latency*1000)}ms"
    )


@bot.command()
async def help(ctx):

    emb = discord.Embed(
        title="TXRP Commands",
        color=discord.Color.purple()
    )

    emb.add_field(
        name="👮 Staff",
        value="$kick $ban $purge /embed"
    )

    emb.add_field(
        name="⚙️ Owner (DM)",
        value="$setstatus $seturl $setpresence $shutdown",
        inline=False
    )

    emb.add_field(
        name="👤 User",
        value="$rank $link $pong",
        inline=False
    )

    emb.timestamp = datetime.datetime.utcnow()

    await ctx.send(embed=emb)


# ======================
# MOD COMMANDS
# ======================

@bot.command()
async def kick(ctx, member: discord.Member, *, reason="No reason"):

    if not any(r.id == MOD_ROLE_ID for r in ctx.author.roles):
        return

    await member.kick(reason=reason)

    await ctx.send(f"👢 {member.name} kicked")


@bot.command()
async def ban(ctx, member: discord.Member, *, reason="No reason"):

    if not any(r.id == MOD_ROLE_ID for r in ctx.author.roles):
        return

    await member.ban(reason=reason)

    await ctx.send(f"🔨 {member.name} banned")


@bot.command()
async def purge(ctx, amount: int):

    if not any(r.id == OWNERSHIP_ROLE_ID for r in ctx.author.roles):
        return

    await ctx.channel.purge(limit=amount+1)

    await ctx.send(
        f"🗑️ Purged {amount}",
        delete_after=3
    )


# ======================
# XP SYSTEM
# ======================

@bot.event
async def on_message(message):

    if message.author.bot:
        return

    if message.guild:

        cursor.execute(
            "INSERT OR IGNORE INTO users VALUES (?, ?, 0, 1)",
            (message.guild.id, message.author.id)
        )

        cursor.execute(
            "UPDATE users SET xp = xp + 5 WHERE guild_id=? AND user_id=?",
            (message.guild.id, message.author.id)
        )

        db.commit()


    await bot.process_commands(message)


# ======================
# START
# ======================

bot.run(TOKEN)

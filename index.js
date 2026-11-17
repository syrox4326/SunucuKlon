// SunucuKlon ana dosyası: botu başlatır ve slash komutlarını çalıştırır.
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, MessageFlags, REST, Routes, PermissionFlagsBits, IntentsBitField } = require('discord.js');
const ayar = require('./utils/ayar');
const { sahipMi, izinliMi, retMesaji } = require('./utils/yetki');
const mute = require('./utils/mute');
const otocevap = require('./utils/otocevap');
const butonrol = require('./utils/butonrol');
const kayit = require('./utils/kayit');
const { hata: hataKutusu } = require('./utils/tasarim');

ayar.ayarlariDogrula();

// Sadece Guilds intent'i kullanılır (mesaj içeriği veya üye okuma yok)
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// commands/ klasöründeki tüm komutları yükle
client.commands = new Collection();
const komutKlasoru = path.join(__dirname, 'commands');
for (const dosya of fs.readdirSync(komutKlasoru).filter((d) => d.endsWith('.js'))) {
  const komut = require(path.join(komutKlasoru, dosya));
  if (komut.data && komut.execute) client.commands.set(komut.data.name, komut);
  else console.warn(`⚠️ ${dosya} dosyasında "data" veya "execute" eksik, atlandı.`);
}

client.on(Events.ChannelCreate, (kanal) => mute.yeniKanal(kanal));

client.once(Events.ClientReady, (c) => {
  mute.zamanlayiciyiBaslat(client);
  for (const g of c.guilds.cache.values()) otocevap.varsayilanlariEkle(g.id, c.user.id);
  console.log(`✅ ${c.user.tag} olarak giriş yapıldı. ${client.commands.size} komut yüklü, ${c.guilds.cache.size} sunucudayım.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Otomatik tamamlama (sunucu listesi)
  if (interaction.isAutocomplete()) {
    if (!sahipMi(interaction.user.id)) return interaction.respond([]).catch(() => {});
    const komut = client.commands.get(interaction.commandName);
    if (komut?.autocomplete) await komut.autocomplete(interaction).catch((e) => console.error('[autocomplete]', e.message));
    return;
  }
  // Rol butonları herkese açıktır (kalıcı: kimlik rolün ID'sini taşır)
  if (interaction.isButton() && interaction.customId.startsWith(butonrol.ONEK)) return butonrol.tikla(interaction);
  if (!interaction.isChatInputCommand()) return;

  const komut = client.commands.get(interaction.commandName);
  if (!komut) return;

  // Güvenlik: varsayılan olarak komutlar sadece bot sahibine açık. `yetki` tanımlayan komutlar:
  //   { enAzRol: 'Moderator' } -> sunucudaki yetkili roller (veritabanı), { yonetici: true } -> Yönetici izni
  if (!izinliMi(interaction, komut.yetki)) {
    return interaction.reply({ embeds: [hataKutusu(retMesaji(komut.yetki))], flags: MessageFlags.Ephemeral });
  }

  try {
    await komut.execute(interaction, client);
  } catch (hata) {
    console.error(`[HATA] /${interaction.commandName}:`, hata);
    const mesaj = '❌ Beklenmeyen bir hata oluştu: ' + (hata.message || hata) + '\nAyrıntı için bot konsoluna bak.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: mesaj, embeds: [], components: [] });
      else await interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
    } catch {
      /* cevap verilemiyorsa yapacak bir şey yok */
    }
  }
});

// Beklenmeyen hatalar botu çökertmesin
process.on('unhandledRejection', (hata) => console.error('[Yakalanmamış hata]', hata));
client.on(Events.Error, (hata) => console.error('[Discord istemci hatası]', hata));

// Mesaj içeriği ve üye listesi "ayrıcalıklı intent"tir: Developer Portal'da açık değilken istenirse giriş bozulur.
// Bu yüzden önce uygulamanın bayraklarına bakılır, sadece açık olanlar istenir.
const MESAJ_ICERIGI_BAYRAK = (1 << 18) | (1 << 19); // GATEWAY_MESSAGE_CONTENT (+ _LIMITED)
const UYE_BAYRAK = (1 << 14) | (1 << 15); // GATEWAY_GUILD_MEMBERS (+ _LIMITED)

client.on(Events.GuildMemberAdd, (uye) => kayit.uyeGirdi(uye).catch((e) => console.error('[uyeGirdi]', e.message)));

client.on(Events.MessageCreate, async (mesaj) => {
  if (!client.mesajIcerigiAcik || mesaj.author.bot || !mesaj.guildId || !mesaj.content) return;
  if (await kayit.mesajIsle(mesaj, client).catch((e) => { console.error('[kayit]', e); return true; })) return;
  const cevap = otocevap.eslestir(mesaj.guildId, mesaj.author.id, mesaj.content);
  if (!cevap) return;
  const izin = mesaj.channel.permissionsFor?.(mesaj.guild.members.me);
  if (!izin?.has(PermissionFlagsBits.SendMessages)) return;
  await mesaj.reply({ content: cevap, allowedMentions: { parse: [], repliedUser: false } }).catch((e) => console.error('[otocevap]', e.message));
});

async function baslat() {
  let bayrak = 0;
  try {
    const rest = new REST({ version: '10' }).setToken(ayar.token());
    bayrak = (await rest.get(Routes.currentApplication())).flags ?? 0;
  } catch {
    /* bayrak okunamazsa ayrıcalıklı intent istenmez */
  }
  client.mesajIcerigiAcik = Boolean(bayrak & MESAJ_ICERIGI_BAYRAK);
  client.uyeIntentAcik = Boolean(bayrak & UYE_BAYRAK);

  const intentler = [GatewayIntentBits.Guilds];
  if (client.mesajIcerigiAcik) intentler.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  else console.warn('⚠️ Message Content Intent kapalı: otomatik cevap ve kayıt komutu çalışmaz.');
  if (client.uyeIntentAcik) intentler.push(GatewayIntentBits.GuildMembers);
  else console.warn('⚠️ Server Members Intent kapalı: yeni üyelere otomatik kayıtsız rolü verilemez.');
  client.options.intents = new IntentsBitField(intentler);

  await client.login(ayar.token());
}

baslat().catch((hata) => {
  console.error('❌ Giriş yapılamadı. Token yanlış olabilir. Ayrıntı:', hata.message);
  process.exit(1);
});

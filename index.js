// SunucuKlon ana dosyası: botu başlatır ve slash komutlarını çalıştırır.
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const ayar = require('./utils/ayar');
const { sahipMi, yetkiliMi } = require('./utils/yetki');
const mute = require('./utils/mute');

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
  if (!interaction.isChatInputCommand()) return;

  const komut = client.commands.get(interaction.commandName);
  if (!komut) return;

  // Güvenlik: varsayılan olarak komutlar sadece bot sahibine açık. `yetki` tanımlayan komutlar,
  // sunucudaki yetkili rollere (veritabanı) de açılır: yetki: { enAzRol: 'Trial Moderator' }
  const izinli = komut.yetki?.enAzRol ? yetkiliMi(interaction, komut.yetki.enAzRol) : sahipMi(interaction.user.id);
  if (!izinli) {
    const mesaj = komut.yetki?.enAzRol ? `⛔ Bu komutu en az **${komut.yetki.enAzRol}** rolündeki yetkililer kullanabilir.` : '⛔ Bu komutu sadece bot sahibi kullanabilir.';
    return interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
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

client.login(ayar.token()).catch((hata) => {
  console.error('❌ Giriş yapılamadı. Token yanlış olabilir. Ayrıntı:', hata.message);
  process.exit(1);
});

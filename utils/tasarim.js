// Moderasyon yanıtlarının ortak görünümü (renkler, altbilgi, alan düzeni)
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const RENK = { mute: 0xe5484d, unmute: 0x30a46c, kick: 0xf97316, ban: 0xb91c1c, bilgi: 0x6a7bff };
// assets/<ad>.gif dosyasını mesaja ekler; embed'de .setImage('attachment://<ad>.gif') ile gösterilir
const gif = (ad) => new AttachmentBuilder(path.join(__dirname, '..', 'assets', `${ad}.gif`), { name: `${ad}.gif` });
const muteGifi = () => gif('mute');

// Ortak iskelet: bot adı üstte, altbilgi + zaman damgası
function taslak(client, renk, baslik) {
  return new EmbedBuilder()
    .setColor(renk)
    .setAuthor({ name: "Kerem's Bot  ·  Moderasyon", iconURL: client.user.displayAvatarURL() })
    .setTitle(baslik)
    .setTimestamp();
}

const alan = (name, value) => ({ name, value: String(value).slice(0, 1024), inline: false });
const zaman = (ms) => `<t:${Math.floor(ms / 1000)}:F>\n<t:${Math.floor(ms / 1000)}:R>`;
const uyeSatiri = (kullanici) => `${kullanici}\n\`${kullanici.id}\``;

// Sade hata / bilgi kutuları
const hata = (metin) => new EmbedBuilder().setColor(RENK.mute).setDescription(metin);
const bilgi = (metin) => new EmbedBuilder().setColor(RENK.bilgi).setDescription(metin);

module.exports = { gif, hata, bilgi, RENK, taslak, alan, zaman, uyeSatiri, muteGifi };

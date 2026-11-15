// Küçük, her yerde kullanılan yardımcı fonksiyonlar.
const { PermissionsBitField } = require('discord.js');

// Belirtilen milisaniye kadar bekler (istekler arasına nefes payı koymak için).
const bekle = (ms) => new Promise((tamam) => setTimeout(tamam, ms));

// Geçerli bir Discord ID'si mi? (17-20 haneli sayı)
const snowflakeMi = (d) => /^\d{17,20}$/.test(String(d || '').trim());

// Uzun metni keser (Discord embed sınırlarını aşmamak için).
function kisalt(metin, uzunluk = 1000) {
  const m = String(metin ?? '');
  return m.length > uzunluk ? m.slice(0, uzunluk - 3) + '...' : m;
}

// Sadece Discord'un kendi görsel sunucularından gelen bağlantılara izin ver (güvenlik).
function cdnMi(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['cdn.discordapp.com', 'media.discordapp.net'].includes(u.hostname);
  } catch {
    return false;
  }
}

// Hareketli (gif) görsel bağlantısını sabit (png) hale getirir.
const statikYap = (url) => (url ? url.replace(/\.gif(\?|$)/, '.png$1') : url);

// 125000 ms -> "2 dk 5 sn"
function sureYaz(ms) {
  const toplam = Math.max(0, Math.round(ms / 1000));
  const dk = Math.floor(toplam / 60);
  const sn = toplam % 60;
  return dk > 0 ? `${dk} dk ${sn} sn` : `${sn} sn`;
}

// [██████░░░░] gibi ilerleme çubuğu
function ilerlemeCubugu(tamam, toplam, uzunluk = 16) {
  if (!toplam) return '░'.repeat(uzunluk);
  const dolu = Math.min(uzunluk, Math.round((tamam / toplam) * uzunluk));
  return '█'.repeat(dolu) + '░'.repeat(uzunluk - dolu);
}

// Sık kullanılan izinlerin Türkçe karşılıkları
const IZIN_TR = {
  Administrator: 'Yönetici',
  ManageGuild: 'Sunucuyu Yönet',
  ManageRoles: 'Rolleri Yönet',
  ManageChannels: 'Kanalları Yönet',
  KickMembers: 'Üyeleri At',
  BanMembers: 'Üyeleri Yasakla',
  ModerateMembers: 'Üyelere Zaman Aşımı Ver',
  ManageMessages: 'Mesajları Yönet',
  ManageNicknames: 'Takma Adları Yönet',
  ManageWebhooks: 'Webhook Yönet',
  ManageThreads: 'Alt Başlıkları Yönet',
  ManageEmojisAndStickers: 'Emoji ve Çıkartmaları Yönet',
  ViewAuditLog: 'Denetim Kaydını Gör',
  ViewChannel: 'Kanalları Gör',
  SendMessages: 'Mesaj Gönder',
  EmbedLinks: 'Bağlantı Yerleştir',
  AttachFiles: 'Dosya Ekle',
  AddReactions: 'Tepki Ekle',
  ReadMessageHistory: 'Mesaj Geçmişini Oku',
  MentionEveryone: '@everyone Etiketle',
  UseExternalEmojis: 'Harici Emoji Kullan',
  CreateInstantInvite: 'Davet Oluştur',
  Connect: 'Bağlan',
  Speak: 'Konuş',
  MuteMembers: 'Üyeleri Sustur',
  DeafenMembers: 'Üyeleri Sağır Et',
  MoveMembers: 'Üyeleri Taşı',
};

// İzin sayısını (bitfield) okunur Türkçe isim listesine çevirir.
function izinAdlari(bitfield) {
  return new PermissionsBitField(BigInt(bitfield)).toArray().map((a) => IZIN_TR[a] || a);
}

// Slash komutlarında sunucu ID alanları için otomatik tamamlama:
// botun bulunduğu sunucuların adını gösterir, seçilince ID'yi yazar.
async function sunucuOtomatik(interaction) {
  const odak = String(interaction.options.getFocused() || '').toLowerCase();
  const secenekler = [...interaction.client.guilds.cache.values()]
    .filter((g) => g.name.toLowerCase().includes(odak) || g.id.includes(odak))
    .slice(0, 25)
    .map((g) => ({ name: `${g.name} (${g.id})`.slice(0, 100), value: g.id }));
  await interaction.respond(secenekler);
}

module.exports = { bekle, snowflakeMi, kisalt, cdnMi, statikYap, sureYaz, ilerlemeCubugu, izinAdlari, sunucuOtomatik };

// İlerleme mesajını belirli aralıklarla günceller.
// Discord, slash komut cevabının düzenlenmesine sadece 15 dakika izin verir.
// Süre dolarsa mesajlar otomatik olarak komutun kullanıldığı kanala gönderilir.
const { EmbedBuilder } = require('discord.js');

class IlerlemeMesaji {
  constructor(interaction, islem) {
    this.interaction = interaction;
    this.islem = islem;
    this.kanalMesaji = null; // 15 dk dolunca kullanılacak yedek mesaj
    this.zamanlayici = null;
    this.yedekHatasiYazildi = false;
  }

  embed() {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`⚙️ ${this.islem.tip === 'klonla' ? 'Klonlama' : 'İşlem'} devam ediyor`)
      .setDescription(`**${this.islem.baslik}**\n\n${this.islem.durumMetni()}`)
      .setFooter({ text: 'Durumu görmek için /durum, durdurmak için /iptal' });
  }

  async guncelle() {
    const e = this.embed();
    try {
      if (this.kanalMesaji) await this.kanalMesaji.edit({ embeds: [e] });
      else await this.interaction.editReply({ embeds: [e], components: [] });
    } catch (hata) {
      // Muhtemelen 15 dakika doldu: kanala yeni mesaj gönder.
      if (!this.kanalMesaji) {
        try {
          this.kanalMesaji = await this.interaction.channel.send({ embeds: [e] });
        } catch (h2) {
          if (!this.yedekHatasiYazildi) {
            console.error('İlerleme mesajı güncellenemedi:', h2.message);
            this.yedekHatasiYazildi = true;
          }
        }
      }
    }
  }

  baslat() {
    this.guncelle();
    this.zamanlayici = setInterval(() => this.guncelle(), 4000);
  }

  // İşlem bitince son raporu gönderir ({ embeds, files }).
  async bitir(rapor) {
    clearInterval(this.zamanlayici);
    try {
      if (this.kanalMesaji) throw new Error('kanal modu');
      await this.interaction.editReply({ ...rapor, components: [] });
    } catch {
      try {
        if (this.kanalMesaji) await this.kanalMesaji.delete().catch(() => {});
        await this.interaction.channel.send(rapor);
      } catch (h) {
        console.error('Son rapor gönderilemedi:', h.message);
      }
    }
  }
}

module.exports = { IlerlemeMesaji };

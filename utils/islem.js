// Devam eden (tek bir) işlemin durumunu tutar. /durum ve /iptal komutları buradan okur.
const { sureYaz, ilerlemeCubugu } = require('./yardimci');

// İptal istendiğinde işlemi güvenle durdurmak için fırlatılan özel sinyal.
class IptalSinyali extends Error {
  constructor() {
    super('İşlem kullanıcı tarafından iptal edildi.');
    this.name = 'IptalSinyali';
  }
}

class Islem {
  constructor(tip, baslik) {
    this.tip = tip;
    this.baslik = baslik;
    this.baslangic = Date.now();
    this.bitisZamani = null;
    this.iptalIstendi = false;
    this.bitti = false;
    this.asamaAdi = 'Hazırlanıyor';
    this.tamam = 0;
    this.toplam = 0;
    this.tamamlananAsamalar = [];
    this.hataSayisi = 0;
    this.atlananSayisi = 0;
    this.sonLoglar = [];
  }

  // Yeni bir aşamaya geç (örn. "Roller", 30 öğe)
  asama(ad, toplam = 0) {
    if (this.toplam > 0) this.tamamlananAsamalar.push(`${this.asamaAdi} ${this.tamam}/${this.toplam}`);
    this.asamaAdi = ad;
    this.tamam = 0;
    this.toplam = toplam;
    this.log(`Aşama başladı: ${ad} (${toplam})`);
  }

  // Bir öğe tamamlandı
  adim() {
    this.tamam++;
  }

  // İptal istenmişse işlemi durdur
  denetle() {
    if (this.iptalIstendi) throw new IptalSinyali();
  }

  log(mesaj) {
    this.sonLoglar.push(mesaj);
    if (this.sonLoglar.length > 8) this.sonLoglar.shift();
    console.log(`[${this.tip}] ${mesaj}`);
  }

  // Ekranda gösterilecek kısa durum yazısı
  durumMetni() {
    const gecen = sureYaz((this.bitisZamani || Date.now()) - this.baslangic);
    const satirlar = [];
    if (this.tamamlananAsamalar.length) satirlar.push('✅ ' + this.tamamlananAsamalar.join('\n✅ '));
    satirlar.push(
      `🔄 **${this.asamaAdi}** ${this.toplam ? `${this.tamam}/${this.toplam}` : ''}\n` +
        (this.toplam ? `\`${ilerlemeCubugu(this.tamam, this.toplam)}\`` : ''),
    );
    satirlar.push(`⏱️ Geçen süre: ${gecen} • ⚠️ Hata: ${this.hataSayisi} • ⏭️ Atlanan: ${this.atlananSayisi}`);
    if (this.iptalIstendi) satirlar.push('🛑 İptal istendi, şu anki adım bitince duracak.');
    return satirlar.join('\n');
  }
}

let aktif = null;
let son = null;

module.exports = {
  IptalSinyali,
  // Yeni işlem başlatır. Zaten bir işlem varsa null döner.
  baslat(tip, baslik) {
    if (aktif && !aktif.bitti) return null;
    aktif = new Islem(tip, baslik);
    return aktif;
  },
  aktifGetir: () => (aktif && !aktif.bitti ? aktif : null),
  sonGetir: () => son,
  bitir(islem, ozet) {
    islem.bitti = true;
    islem.bitisZamani = Date.now();
    islem.ozet = ozet;
    son = islem;
  },
};

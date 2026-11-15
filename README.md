# 🤖 SunucuKlon

**SunucuKlon**, bir Discord sunucusunun **yapısını** (roller, kategoriler, kanallar, izinler, sunucu ayarları) başka bir sunucuya kopyalayan bir bottur.

Bu rehber hiç teknik bilgisi olmayan biri için yazıldı. Adımları sırayla uygulaman yeterli. Takıldığın yerde en alttaki **"Sık hatalar ve çözümleri"** bölümüne bak.

---

## ✅ Neler kopyalanır, neler kopyalanmaz?

**Kopyalananlar**
- Roller: ad, renk, "ayrı listele" (hoist), etiketlenebilir olması, izinler, sıralama (hiyerarşi), ikon/emoji (varsa)
- `@everyone` rolünün izinleri
- Kategoriler ve sıraları
- Kanallar: metin, ses, duyuru, forum, sahne (stage), medya. Ad, konu, NSFW, yavaş mod, bitrate, kullanıcı limiti, forum etiketleri, sıralama
- Kanal ve kategori izinleri (rol bazlı). Bot, eski rolleri yeni rollerle otomatik eşleştirir.
- Sunucu ayarları: ad, ikon, banner, doğrulama seviyesi, varsayılan bildirim ayarı, AFK kanalı ve süresi, sistem mesajları kanalı
- İsteğe bağlı: özel emojiler ve çıkartmalar

**Kopyalanmayanlar**
- ❌ Mesajlar (kesinlikle)
- ❌ Üyeler ve üyelerin rolleri
- ❌ Webhook'lar, davetler
- ❌ Botlar ve bot rolleri (bunlar için `/botlari_listele` komutuyla ekleme linki üretilir)
- ❌ Belirli bir üyeye özel kanal izinleri (sadece rol izinleri kopyalanır)

---

## 1️⃣ Node.js nasıl kurulur?

Node.js, botun çalışması için gereken programdır.

1. Tarayıcında **https://nodejs.org** adresine git.
2. Sayfadaki yeşil **"LTS"** yazan büyük düğmeye tıkla. Bir kurulum dosyası inecek.
3. İnen dosyayı çalıştır. Hep **"Next / İleri"** de, sonunda **"Install"** de.
4. Kurulum bitince kontrol et:
   - **Windows:** Başlat menüsüne `cmd` yaz, "Komut İstemi"ni aç.
   - **Mac:** `Terminal` uygulamasını aç.
   - Şunu yaz ve Enter'a bas: `node -v`
   - `v18...`, `v20...` veya `v22...` gibi bir sayı görürsen kurulum tamam. (En az 18 olmalı.)

---

## 2️⃣ Discord Developer Portal'da uygulama ve bot oluşturma, token alma

1. **https://discord.com/developers/applications** adresine git, Discord hesabınla giriş yap.
2. Sağ üstteki mavi **"New Application"** düğmesine bas. Adına `SunucuKlon` yaz, kutuyu işaretle, **"Create"** de.
3. Açılan sayfada **"General Information"** bölümünde **"Application ID"** yazan bir sayı göreceksin. **"Copy"** düğmesiyle kopyala ve bir not defterine yapıştır. Bu senin **CLIENT_ID**'n.
4. Soldaki menüden **"Bot"** sekmesine tıkla.
5. **"Reset Token"** düğmesine bas, **"Yes, do it!"** de. Şifreni girmen istenebilir.
6. Ekrana uzun bir yazı çıkacak: işte bu **bot token'ı**. **"Copy"** ile kopyala ve not defterine yapıştır.

> 🚨 **ÇOK ÖNEMLİ:** Token, botunun şifresidir. **Kimseyle paylaşma**, ekran görüntüsünü atma, internete veya GitHub'a yükleme. Biri token'ı ele geçirirse botunu (ve ona yetki verdiğin sunucuları) yönetebilir. Sızdırdığını düşünürsen aynı sayfadan hemen **"Reset Token"** de.

7. Bu sayfada **"Privileged Gateway Intents"** başlığının altındaki üç anahtarı (Presence, Server Members, Message Content) **AÇMANA GEREK YOK**. Bu bot sadece en temel izni kullanır.
8. **Senin kullanıcı ID'ni** de not et (bu **OWNER_ID**'n olacak; botu sadece sen kullanabileceksin):
   - Discord uygulamasında **Ayarlar > Gelişmiş** bölümünden **"Geliştirici Modu"**nu aç.
   - Sonra kendi adına (sohbette veya üye listesinde) sağ tıkla > **"Kullanıcı ID'sini Kopyala"**.

---

## 3️⃣ Botu Yönetici (Administrator) izniyle sunucularına davet etme

Bot **hem kaynak hem hedef sunucuda** olmalı ve ikisinde de **Yönetici** izni olmalı.

1. Developer Portal'da uygulamanda soldan **"OAuth2"** sekmesine tıkla.
2. Aşağı kaydır, **"OAuth2 URL Generator"** bölümünü bul.
3. **"SCOPES"** kutularından şu ikisini işaretle: **`bot`** ve **`applications.commands`**
4. Altta **"BOT PERMISSIONS"** bölümü açılacak. **`Administrator`** kutusunu işaretle.
5. En alttaki **"GENERATED URL"** kutusundaki bağlantıyı **"Copy"** ile kopyala.
6. Bu bağlantıyı tarayıcının adres çubuğuna yapıştır ve aç.
7. **"Sunucuya ekle"** listesinden **kaynak sunucunu** seç, **"Yetkilendir"** de. Gerekirse "ben robot değilim" kutusunu işaretle.
8. **Aynı bağlantıyı tekrar aç** ve bu sefer **hedef sunucunu** seç. Yetkilendir.

> Sunucunun listede çıkması için o sunucuda **"Sunucuyu Yönet"** yetkin olmalı (kendi sunucunsa sorun yok).

**Sunucu ID'lerini bulmak için:** Geliştirici Modu açıkken sol taraftaki sunucu simgesine sağ tıkla > **"Sunucu ID'sini Kopyala"**. Kaynak ve hedef için ayrı ayrı yap, not et.

---

## 4️⃣ `.env` dosyasını oluşturma ve doldurma

`.env`, bot şifrelerini koyduğun gizli ayar dosyasıdır.

1. Proje klasöründe **`.env.example`** adlı dosyayı bul.
2. Bu dosyayı **kopyala** ve kopyanın adını **`.env`** yap (başında nokta var, `.txt` gibi bir uzantı olmamalı).
   - **Windows ipucu:** Dosya uzantıları gizliyse `.env.txt` olabilir. Klasörde **Görünüm > Dosya adı uzantıları** kutusunu işaretle ve adı düzelt.
   - **Mac ipucu:** Noktayla başlayan dosyalar gizlenir. Finder'da **Cmd + Shift + .** tuşlarıyla gizli dosyaları göster.
   - Veya komut satırında proje klasöründeyken: Windows'ta `copy .env.example .env`, Mac'te `cp .env.example .env`
3. `.env` dosyasını Not Defteri ile aç ve `=` işaretinden sonra boşlukları doldur (**tırnak koyma, boşluk bırakma**):

```
DISCORD_TOKEN=buraya-bot-token-yapisir
CLIENT_ID=buraya-application-id
OWNER_ID=buraya-senin-kullanici-id-n
GUILD_ID=komutlarin-gorunecegi-sunucunun-id-si
```

   - `GUILD_ID`: Komutları hangi sunucuda yazacaksan onun ID'si (genelde kaynak veya hedef sunucu). İstersen ikisini de virgülle yazabilirsin: `GUILD_ID=111111111111111111,222222222222222222`
4. Dosyayı kaydet. **Bu dosyayı kimseyle paylaşma.**

---

## 5️⃣ Kurulum: `npm install`, komutları kaydetme, botu çalıştırma

1. Komut satırını (cmd / Terminal) **proje klasöründe** aç.
   - Windows: Klasörü Dosya Gezgini'nde aç, üstteki adres çubuğuna `cmd` yaz, Enter.
   - Mac: Terminal'i aç, `cd ` yaz (sonda boşluk), klasörü Terminal penceresine sürükle, Enter.
2. Gerekli paketleri kur (sadece ilk seferde):
   ```
   npm install
   ```
3. Slash komutlarını Discord'a kaydet:
   ```
   npm run komutlari-kaydet
   ```
   `✅ 6 komut kaydedildi` gibi bir yazı görmelisin.
4. Botu çalıştır:
   ```
   npm start
   ```
   `✅ SunucuKlon#1234 olarak giriş yapıldı` yazısı çıkarsa bot çalışıyor demektir.

> ⚠️ **Bu pencereyi kapatırsan bot durur.** Klonlama bitene kadar açık bırak. Botu durdurmak için pencerede **Ctrl + C**'ye bas.

---

## 6️⃣ Bot rolünü rol listesinde EN ÜSTE sürükleme (çok önemli!)

**Neden gerekli?** Discord'da bir rol, sadece **kendinden altta** olan rolleri yönetebilir. Bot rolü listenin üstünde değilse:
- Hedefteki eski rolleri **silemez** (temizle seçeneğinde),
- Rolleri düzenleyip sıralayamaz.

**Nasıl yapılır?** (Hedef sunucuda, kaynakta da yapman iyi olur)
1. Discord'da sunucunun adına tıkla > **"Sunucu Ayarları"**.
2. Soldan **"Roller"** sekmesini aç.
3. Listede botun adıyla aynı olan rolü bul (`SunucuKlon` gibi).
4. Bu rolü **fare ile basılı tutup en üste sürükle** (`@everyone` hariç en üstte olsun).
5. Değişiklikleri kaydet.

Bot, hedefte bu kontrolü kendisi de yapar. Rol yeterince yüksek değilse işlem başlamadan **net bir hata mesajı** verir.

---

## 7️⃣ Komutların kullanımı

Tüm komutları **sadece sen** (OWNER_ID'deki kişi) kullanabilirsin. Sunucu ID'si yazarken kutuya tıklayınca botun bulunduğu sunucuların listesi **otomatik çıkar**, seçmen yeterli.

### `/klonla kaynak_id hedef_id [temizle] [emoji] [kuru_calistirma]`
Kaynağın yapısını hedefe kopyalar.

| Seçenek | Ne yapar? |
|---|---|
| `kaynak_id` | Kopyalanacak sunucu |
| `hedef_id` | Kopyanın yapılacağı sunucu |
| `temizle` | `True` ise hedefteki **tüm kanalları ve rolleri siler** (bot ve yönetilen roller hariç). İkinci bir kırmızı onay ister. |
| `emoji` | `True` ise özel emojiler ve çıkartmalar da kopyalanır |
| `kuru_calistirma` | `True` ise **hiçbir şey yapılmaz**, sadece ne yapılacağı listelenir |

Nasıl çalışır:
1. Önce bot kontrolleri yapar (yetki, rol sırası, limitler).
2. Bir **özet** gösterir (kaç rol, kategori, kanal) ve **Onayla / İptal** düğmeleri çıkar.
3. `temizle` seçtiysen bir de **kırmızı uyarılı ikinci onay** çıkar.
4. İşlem başlar, ilerleme mesajı canlı güncellenir (örn. "Roller 12/30").
5. Bitince **rapor** gelir: başarılı, atlanan ve hata alan öğeler. Ayrıntılı liste `klon-raporu.txt` dosyası olarak eklenir.

**Örnekler**
- Önce denemek için (hiçbir şey değişmez): `/klonla kaynak_id:… hedef_id:… kuru_calistirma:True`
- Boş bir hedefe kopyala: `/klonla kaynak_id:… hedef_id:…`
- Hedefi sıfırlayıp kopyala, emojilerle: `/klonla kaynak_id:… hedef_id:… temizle:True emoji:True`

> 💡 **Önerim:** İlk seferde mutlaka `kuru_calistirma:True` ile dene.

### `/durum`
Devam eden işlemin ilerlemesini gösterir (hangi aşamada, kaç tanesi bitti, kaç hata).

### `/iptal`
Devam eden işlemi güvenle durdurur. Bot şu anki küçük adımı bitirip durur ve neyin yapıldığını raporlar. (Yapılanlar geri alınmaz.)

### `/yedek_al kaynak_id`
Sunucu yapısını bir **JSON dosyası** olarak sana gönderir. Dosyayı bilgisayarına kaydet. İçinde mesaj veya üye bilgisi yoktur.

### `/yedekten_yukle hedef_id dosya [temizle] [emoji] [kuru_calistirma]`
`/yedek_al` ile aldığın JSON dosyasını seçip hedefe yükler. Seçenekler `/klonla` ile aynıdır, onay adımları da aynı şekilde çalışır.

### `/botlari_listele kaynak_id hedef_id`
Kaynak sunucudaki botları bulur (kendi botumuz hariç) ve her biri için **hedefe ekleme linki** üretir. Linkler sayfalara bölünür.
- Hedefte zaten olan botlar **"Zaten ekli"** diye işaretlenir.
- Linklere sırayla tıklayıp yetkilendir.
- Botların **kendi ayarları kopyalanmaz** (her bot kendi ayarını ister).
- Özel (herkese açık olmayan) botların linki çalışmayabilir.
- Not: Bu bot üye listesini okumaz. Botları, Discord'un onlara otomatik verdiği "yönetilen rol" üzerinden bulur. Hiç rolü/izni olmayan bir bot listede çıkmayabilir.

---

## 8️⃣ Sık hatalar ve çözümleri

| Gördüğün sorun | Neden ve çözüm |
|---|---|
| `.env dosyasında şu ayarlar eksik` | `.env` dosyası yok veya boş. Adım 4'ü tekrar yap. Dosya adının `.env.txt` olmadığından emin ol. |
| `Giriş yapılamadı. Token yanlış olabilir` | Token'ı yanlış/eksik yapıştırdın. Developer Portal > Bot > **Reset Token** ile yenisini al, `.env`'e yapıştır (başında/sonunda boşluk olmasın). |
| `node` veya `npm` tanınmıyor | Node.js kurulu değil ya da kurulumdan sonra komut satırını yeniden açmadın. Adım 1'i yap, pencereyi kapatıp yeniden aç. |
| Slash komutları (`/klonla`) çıkmıyor | `npm run komutlari-kaydet` komutunu çalıştırdın mı? `.env`'deki `GUILD_ID` doğru sunucu mu? Bot o sunucuda ve davet ederken `applications.commands` işaretli miydi? Discord'u `Ctrl+R` ile yenile. |
| `komutlar kaydedilemedi` / `Missing Access` | `GUILD_ID` yanlış ya da bot o sunucuda değil. Botu davet et (Adım 3), ID'yi kontrol et. |
| `Bu komutu sadece bot sahibi kullanabilir` | `OWNER_ID` senin kullanıcı ID'n değil. Geliştirici Modu ile kendi ID'ni kopyalayıp `.env`'e yaz, botu yeniden başlat. |
| `Kaynak/Hedef sunucu bulunamadı. Bot bu sunucuda olmayabilir` | Botu o sunucuya davet etmemişsin ya da ID yanlış. Adım 3'ü yap. |
| `Bot hedef sunucuda Yönetici yetkisine sahip değil` | Botu Yönetici izniyle yeniden davet et (Adım 3) veya Roller'den bot rolüne "Yönetici" ver. |
| `Bot rolü yeterince yüksek değil` | Adım 6: bot rolünü hedef sunucuda listenin en üstüne sürükle. |
| `Rol limiti aşılıyor` / `Kanal limiti aşılıyor` | Discord en fazla 250 rol ve 500 kanala izin verir. `temizle:True` kullan veya hedefteki gereksizleri elle sil. |
| Duyuru/forum/sahne kanalları **atlandı** | Hedefte **Topluluk (Community)** kapalı. Hedefte Sunucu Ayarları > **Topluluğu Etkinleştir** adımlarını tamamla, sonra tekrar çalıştır. (Topluluğu bot açamaz, sadece sen açabilirsin.) |
| Banner veya rol ikonları **atlandı** | Bu özellikler sunucunun **boost seviyesi 2** olmasını ister. Hedef yeterli seviyede değilse atlanır, hata değildir. |
| Bazı emoji/çıkartmalar **atlandı** | Emoji ve çıkartma sayısı boost seviyesine göre sınırlıdır. Limit dolunca kalanlar atlanır ve raporda yazar. |
| İşlem çok uzun sürüyor | Discord, kanal/emoji oluşturma hızını sınırlar (rate limit). Bot beklemeyi kendi yönetir. Büyük sunucularda **birkaç dakikadan yarım saate** kadar sürebilir. Pencereyi kapatma. `/durum` ile bak. |
| İlerleme mesajı bir süre sonra kanala düştü | Discord, slash komut cevabının düzenlenmesine 15 dakika izin verir. Süre dolunca bot ilerlemeyi ve raporu komutu yazdığın **kanala** gönderir (botun o kanalda yazma izni olmalı). |
| `temizle` sırasında bazı kanallar silinemedi | Topluluk açık sunucularda "Kurallar" ve "Topluluk güncellemeleri" kanalları Discord için zorunludur, silinemez. Raporda hata olarak görünür, sorun değil. |
| Aynı adlı eski roller kaldı | `temizle` kullanmazsan bot eski rolleri silmez ve yenilerini **ekler**. Temiz bir sonuç için hedefi önce boşalt veya `temizle:True` kullan. |
| Bot kendi kendine kapandı | Pencereyi kapatmış, bilgisayar uyumuş ya da internet gitmiş olabilir. `npm start` ile yeniden başlat. Başlarken hata varsa pencerede Türkçe açıklaması yazar. |

---

## 🔒 Güvenlik notları
- Token ve ayarlar sadece `.env` dosyasında durur. `.gitignore` bu dosyanın GitHub'a gitmesini engeller. Repoya sadece boş değerli `.env.example` girer.
- Tüm komutlar sadece `OWNER_ID`'deki kişiye açıktır.
- Bot sadece `Guilds` intent'ini kullanır. Mesaj içeriği veya üye listesi okumaz.
- `/yedekten_yukle` yalnızca Discord'un kendi görsel adreslerinden (`cdn.discordapp.com`) görsel indirir.

## 📁 Dosya yapısı
```
index.js              Botu başlatır
deploy-commands.js    Slash komutlarını Discord'a kaydeder
commands/             Komutlar (klonla, durum, iptal, yedek_al, yedekten_yukle, botlari_listele)
utils/                Yardımcı kodlar (yapı okuma, klonlama motoru, kontroller, rapor)
.env.example          Ayar dosyası örneği (boş değerlerle)
```

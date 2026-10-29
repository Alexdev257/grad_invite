# 🎓 Thiệp mời Lễ Tốt nghiệp (Next.js + Three.js)

Thiệp mời điện tử 3D: nhân vật vẫy tay chào → khoe bằng tốt nghiệp → đứng yên lệch
**phải**, từ từ hiện lời mời với **tên khách lấy từ `?name=`**, thông tin ngày/giờ/địa
điểm ở dưới giữa trang. Nền phía sau là sân khấu lễ do Meshy tạo.

## Chạy

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Mở kèm tên khách mời:

```
http://localhost:3000/?name=Nguyễn Văn An
```

Build production:

```bash
pnpm build && pnpm start
```

## Tham số URL

| Param        | Ý nghĩa                                             |
| ------------ | --------------------------------------------------- |
| `?name=`     | Tên người được mời (hiện lớn ở trên giữa trang)      |
| `?stage=`    | (QA) nhảy thẳng tới pha: `diploma` / `final` |
| `?debug=1`   | (QA) bật log chẩn đoán ra console                    |

## Sửa nội dung thiệp

Ngày / giờ / địa điểm / tiêu đề: sửa trong **`lib/config.ts`**.

## Cấu trúc

```
app/            layout, page (đọc ?name= phía server), CSS
components/
  GradInvite.tsx   toàn bộ scene Three.js + kịch bản + overlay chữ
lib/config.ts      nội dung thiệp (hardcode)
public/
  models/character.glb  nhân vật và animation vẫy tay/đứng yên
  hdri/*_2k.hdr    ảnh nền 360° (Poly Haven, CC0), chỉ tải khi dùng `?hdri=`:
                   theater_01, music_hall_01, graaff_reinet_groote_kerk
  grad_bg.webp    ảnh nền tốt nghiệp đã nén
  fpt_diploma.webp ảnh bằng đã nén
scripts/
  shot.mjs         chụp ảnh QA bằng Chrome hệ thống (puppeteer-core)
  meshy*.mjs        (cũ) sinh prop 3D bằng Meshy — không còn dùng cho nền
```

## Background & ánh sáng

- **Nền**: ảnh `public/grad_bg.webp` đặt bằng CSS (`.bg-photo`, `background-size: cover`)
  nằm dưới canvas trong suốt → phủ kín mọi tỉ lệ, không méo, không vỡ. Đổi nền = thay
  file `grad_bg.webp`.
- **Ánh sáng**: RoomEnvironment có sẵn để trang không cần tải HDRI khi mở. Có thể bật
  HDRI thật (Poly Haven, **CC0**) bằng `?hdri=theater_01`, `?hdri=music_hall_01` hoặc
  `?hdri=graaff_reinet_groote_kerk`; xoay nguồn sáng qua `?rot=`.

## Responsive — đẹp trên mọi thiết bị

Đã kiểm thử bằng ảnh chụp thật ở nhiều kích thước (iPhone SE 320, phone dọc/ngang,
iPad dọc/ngang, desktop, ultrawide 2560):

- Nền ảnh dùng `cover` → luôn phủ kín, không méo/không viền đen.
- Chữ trên/dưới cộng `safe-area` (tránh tai thỏ); tên tự xuống dòng; thông tin **xếp
  dọc** trên màn hẹp, **hàng ngang** trên màn rộng.
- Màn **landscape thấp** (điện thoại nằm ngang): chữ thu nhỏ theo chiều cao + camera
  **zoom xa** để nhân vật nhỏ lại, không bao giờ đè chữ.
- Mô hình và hai animation dùng chung một tệp GLB; texture được giảm còn 2k và nén
  WebP. Ảnh nền/bằng cũng dùng WebP.
- HDRI dùng bản **2k** nếu được bật bằng URL (mặc định không tải tệp HDRI).
- **Canvas 3D luôn phủ đúng vùng nhìn**: đo theo chính `#stage` + `ResizeObserver`
  (không phụ thuộc `window.innerWidth`) và ép CSS `100%` → không bao giờ lệch nhân vật
  hay lộ dải nền, kể cả trên Safari iOS khi ẩn/hiện thanh URL, xoay máy, hay zoom.
- **Nhân vật luôn ở GIỮA & chân bám sàn khi chào**: camera bám theo xương `Hips` —
  trục **X** ở mọi pha (giữ giữa), thêm trục **Y+Z** ở pha **vẫy tay/hiện bằng** để
  bù bước-lùi + nhún của animation (nếu không chân sẽ trôi lên khỏi sàn). Pha cuối cố
  ý lệch phải. Màn dọc camera lùi thêm cho trọn người + có lề.
- **Nhân vật đứng ĐÚNG TRÊN SÀN của ảnh nền**: khung hình neo bàn chân vào ~84% chiều
  cao màn (nơi sàn quảng trường trong `grad_bg.webp`). Vì ảnh nền `cover` hiện đủ chiều
  cao ở mọi tỉ lệ < 1.79 nên mức sàn trùng nhau trên điện thoại/iPad/desktop 16:9. Pha
  cuối trên màn dọc neo cao hơn chút (0.80) để chân không đè khối chữ dưới.
# grad_invite
# grad_invite

// -----------------------------------------------------------------------------
// Nội dung thiệp mời — CHỈNH SỬA TẠI ĐÂY
// Tên người được mời lấy từ URL:  ?name=Nguyễn Văn A
// Các thông tin còn lại (ngày/giờ/địa điểm) cố định bên dưới.
// -----------------------------------------------------------------------------

export const INVITE = {
  /** Dòng tiêu đề nhỏ phía trên tên (kính ngữ / lời mời) */
  invitePrefix: "Thân mời",
  /** Dòng dưới tên, dẫn vào sự kiện */
  inviteSuffix: "đến tham dự",

  /** Tên sự kiện — dòng lớn nhất */
  eventTitle: "LỄ TỐT NGHIỆP",
  /** Tên người tốt nghiệp (tân khoa) — hiển thị dưới tên sự kiện */
  graduate: "Bùi Phước Thắng",
  /** Tên trường / đơn vị tổ chức */
  school: "TRƯỜNG ĐẠI HỌC FPT",

  /** Thông tin hiển thị dưới giữa trang (mẫu tạm — hãy thay bằng nội dung thật) */
  time: "10:00 - 12:30 SÁNG",
  date: "Thứ Bảy · 07 tháng 11, 2026",
  venue: "Đại học FPT, Khu CNC Quận 9, Tp. Hồ Chí Minh",

  /** Dùng khi URL không có ?name= */
  defaultName: "Bạn thân mến",
} as const;

export type InviteConfig = typeof INVITE;

// FAQ entries shown beneath the pricing plans. Edit copy here — the FAQ
// accordion component consumes this array unchanged.

export interface PricingFaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: PricingFaqItem[] = [
  {
    question: 'Tôi có thể hủy gói bất kỳ lúc nào không?',
    answer:
      'Có, bạn có thể hủy gói bất kỳ lúc nào trong phần Cài đặt tài khoản. Gói sẽ còn hiệu lực đến hết chu kỳ đã thanh toán.',
  },
  {
    question: 'Có được hoàn tiền nếu không hài lòng?',
    answer:
      'Chúng tôi hỗ trợ hoàn tiền 100% trong vòng 7 ngày đầu tiên nếu bạn chưa sử dụng quá 20% quota của gói.',
  },
  {
    question: 'Tôi có thể nâng cấp hoặc hạ gói giữa chừng không?',
    answer:
      'Được, bạn có thể nâng cấp bất kỳ lúc nào và phần chênh lệch sẽ được tính theo tỷ lệ thời gian sử dụng còn lại.',
  },
  {
    question: 'Phương thức thanh toán nào được hỗ trợ?',
    answer:
      'Hiện tại hỗ trợ chuyển khoản ngân hàng nội địa qua mã VietQR, sẽ sớm tích hợp thêm thẻ Visa, Momo và ZaloPay.',
  },
];

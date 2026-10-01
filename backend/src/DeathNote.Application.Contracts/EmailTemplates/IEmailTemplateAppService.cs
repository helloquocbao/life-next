using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace DeathNote.EmailTemplates;

/// <summary>
/// Quản lý mẫu email trên Admin Console. <c>id</c> là khoá mẫu (vd. <c>trustee-invitation</c>),
/// đặt tên <c>id</c> để ABP sinh route dạng <c>/api/app/email-template/{id}</c>.
/// </summary>
public interface IEmailTemplateAppService : IApplicationService
{
    Task<ListResultDto<EmailTemplateDto>> GetListAsync();
    Task<EmailTemplateDto> GetAsync(string id);
    Task<EmailDeliveryInfoDto> GetDeliveryInfoAsync();
    Task<EmailTemplateDto> UpdateAsync(string id, UpdateEmailTemplateInput input);
    /// <summary>Xoá bản tuỳ chỉnh, quay về nội dung mặc định.</summary>
    Task<EmailTemplateDto> ResetAsync(string id);
    /// <summary>Xem trước nội dung đang soạn (chưa lưu) với giá trị mẫu.</summary>
    Task<EmailPreviewDto> PreviewAsync(string id, UpdateEmailTemplateInput input);
    /// <summary>Gửi thử nội dung đang soạn tới một địa chỉ — báo lỗi thật nếu nhà cung cấp từ chối.</summary>
    Task SendTestAsync(string id, SendTestEmailInput input);
}

using Volo.Abp.Application.Services;

namespace DeathNote.Vaults;

/// <summary>API két dữ liệu của owner — chỉ trao đổi ciphertext.</summary>
public interface IVaultAppService : IApplicationService
{
    Task<VaultDto> GetAsync();
    Task<VaultDto> InitializeAsync(InitializeVaultInput input);
    Task ChangePassphraseAsync(ChangePassphraseInput input);
    Task<List<VaultItemDto>> GetItemsAsync();
    Task<VaultItemDto> CreateItemAsync(SaveVaultItemInput input);
    Task<VaultItemDto> UpdateItemAsync(Guid id, SaveVaultItemInput input);
    Task DeleteItemAsync(Guid id);
    Task<VaultDto> DistributeKeysAsync(DistributeKeysInput input);

    /// <summary>
    /// Từ bỏ két hiện tại (quên cả mật khẩu chính lẫn 12 từ khôi phục) — xoá vĩnh viễn toàn bộ hạng mục,
    /// mảnh khoá và phân bổ đã phát cho người nhận, rồi cho phép tạo két mới từ đầu. KHÔNG THỂ HOÀN TÁC.
    /// </summary>
    Task AbandonAsync();
}

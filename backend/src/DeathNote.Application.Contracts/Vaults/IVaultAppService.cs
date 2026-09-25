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
}

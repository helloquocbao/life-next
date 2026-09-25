namespace DeathNote.Notifications;

/// <summary>Cổng gửi thông báo đa kênh. Thay nhà cung cấp SMS/Push chỉ cần thay implementation.</summary>
public interface INotificationSender
{
    Task SendAsync(NotificationMessage message);
}

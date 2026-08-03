export type BookingEndNotification = {
  id: string;
  title: string;
  roomName: string;
  endsAt: string;
};

export type NotificationsResponse = {
  notifications?: BookingEndNotification[];
  error?: {
    message?: string;
  };
};

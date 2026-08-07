export type BookingEndNotification = {
  id: string;
  title: string;
  roomName: string;
  endsAt: string;
  nextBookingTitle: string | null;
};

export type NotificationsResponse = {
  notifications?: BookingEndNotification[];
  error?: {
    message?: string;
  };
};

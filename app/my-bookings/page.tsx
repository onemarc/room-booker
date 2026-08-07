import MyBookingsRoute, { metadata } from "./MyBookingsRoute";

// Keep Next's route entrypoint on its required filename while the server
// implementation remains discoverable by its feature-specific name.
export { metadata };
export default MyBookingsRoute;

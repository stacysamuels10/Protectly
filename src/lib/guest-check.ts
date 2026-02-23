export interface GuestCheckResult {
  isApproved: boolean
  rejectionReason: string
  useGuestCancelMessage: boolean
}

export function evaluateGuestCheckMode(
  mode: string,
  inviteeApproved: boolean,
  approvedGuests: string[],
  unapprovedGuests: string[],
  guestEmails: string[],
): GuestCheckResult {
  switch (mode) {
    case 'ALLOW_ALL':
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }

    case 'STRICT':
      if (!inviteeApproved) {
        return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      }
      if (unapprovedGuests.length > 0) {
        return { isApproved: false, rejectionReason: `Unapproved guest(s): ${unapprovedGuests.join(', ')}`, useGuestCancelMessage: true }
      }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }

    case 'PRIMARY_ONLY':
      return {
        isApproved: inviteeApproved,
        rejectionReason: inviteeApproved ? '' : 'Email not on allowlist',
        useGuestCancelMessage: false,
      }

    case 'ANY_APPROVED': {
      const anyApproved = inviteeApproved || approvedGuests.length > 0
      return {
        isApproved: anyApproved,
        rejectionReason: anyApproved ? '' : 'No participants on allowlist',
        useGuestCancelMessage: false,
      }
    }

    case 'NO_GUESTS':
      if (!inviteeApproved) {
        return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      }
      if (guestEmails.length > 0) {
        return { isApproved: false, rejectionReason: `Additional guests not allowed: ${guestEmails.join(', ')}`, useGuestCancelMessage: true }
      }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }

    default:
      // Fallback to strict mode
      if (!inviteeApproved) {
        return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      }
      if (unapprovedGuests.length > 0) {
        return { isApproved: false, rejectionReason: `Unapproved guest(s): ${unapprovedGuests.join(', ')}`, useGuestCancelMessage: true }
      }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }
  }
}

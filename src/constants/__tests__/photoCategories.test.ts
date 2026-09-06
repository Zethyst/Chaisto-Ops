import { PHOTO_CATEGORIES, REQUIRED_PHOTO_CATEGORIES } from '../index';

/**
 * The server enforces the same list: POST /reports rejects a submission without
 * these, and PATCH /reports/:id/photos only accepts the optional ones after the
 * fact. If the two disagree, staff either get blocked by a photo the app calls
 * optional, or submit without one the server thinks is required.
 */
const SERVER_REQUIRED = ['cash', 'stock'];
const SERVER_ADDABLE_LATER = ['cartClosing', 'milkPacket'];

describe('report photos', () => {
  it('requires only the photos the server insists on', () => {
    expect(REQUIRED_PHOTO_CATEGORIES.map((c) => c.key).sort()).toEqual([...SERVER_REQUIRED].sort());
  });

  it('does not block the day on the milk packet shot', () => {
    // Often taken when the delivery arrives rather than at closing time
    const milk = PHOTO_CATEGORIES.find((c) => c.key === 'milkPacket');
    expect(milk?.required).toBe(false);
  });

  it('lets every optional photo be added after submission', () => {
    const optional = PHOTO_CATEGORIES.filter((c) => !c.required).map((c) => c.key).sort();
    expect(optional).toEqual([...SERVER_ADDABLE_LATER].sort());
  });

  it('still asks for the cash and stock evidence', () => {
    expect(PHOTO_CATEGORIES.find((c) => c.key === 'cash')?.required).toBe(true);
    expect(PHOTO_CATEGORIES.find((c) => c.key === 'stock')?.required).toBe(true);
  });
});

import { isSuperEffective, restricts } from '../typeEffectiveness';

describe('Type Effectiveness', () => {
  describe('isSuperEffective', () => {
    it('should return true for fire vs grass', () => {
      expect(isSuperEffective('fire', 'grass')).toBe(true);
    });

    it('should return true for water vs fire', () => {
      expect(isSuperEffective('water', 'fire')).toBe(true);
    });

    it('should return true for grass vs water', () => {
      expect(isSuperEffective('grass', 'water')).toBe(true);
    });

    it('should return false for grass vs fire', () => {
      expect(isSuperEffective('grass', 'fire')).toBe(false);
    });

    it('should return false for water vs grass', () => {
      expect(isSuperEffective('water', 'grass')).toBe(false);
    });

    it('should return true for electric vs water', () => {
      expect(isSuperEffective('electric', 'water')).toBe(true);
    });

    it('should return true for ice vs dragon', () => {
      expect(isSuperEffective('ice', 'dragon')).toBe(true);
    });

    it('should return false for normal vs anything', () => {
      expect(isSuperEffective('normal', 'fire')).toBe(false);
      expect(isSuperEffective('normal', 'water')).toBe(false);
    });
  });

  describe('restricts', () => {
    it('should return true when adjacent tile is super effective', () => {
      expect(restricts('fire', 'grass')).toBe(true);
      expect(restricts('water', 'fire')).toBe(true);
    });

    it('should return false when adjacent tile is not super effective', () => {
      expect(restricts('grass', 'fire')).toBe(false);
      expect(restricts('fire', 'water')).toBe(false);
    });
  });
});

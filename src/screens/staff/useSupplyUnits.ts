import { useSelector } from 'react-redux';
import { RootState } from '../../store';

/**
 * Reports store milk in litres and momos in plate-equivalents, but staff count
 * milk in packets and momos in pieces. These factors convert between the two:
 * `displayed = stored × factor`.
 */
export function useSupplyUnits() {
  const { milkMlPerPacket, momoPiecesPerPlate } = useSelector((s: RootState) => s.menu);
  return {
    milkMlPerPacket,
    momoPiecesPerPlate,
    // litres → packets
    milkPacketsPerLitre: milkMlPerPacket > 0 ? 1000 / milkMlPerPacket : 2,
    // plates → pieces
    momoPiecesPerPlateFactor: momoPiecesPerPlate > 0 ? momoPiecesPerPlate : 1,
  };
}

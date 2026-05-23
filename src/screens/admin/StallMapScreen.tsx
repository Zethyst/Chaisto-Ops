import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { authService } from '../../services/authService';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';
import { haptics } from '../../utils/haptics';

interface StallPoint {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

const PRAYAGRAJ = { latitude: 25.4358, longitude: 81.8463, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export default function StallMapScreen() {
  const { user } = useSelector((s: RootState) => s.auth);
  const mapRef = useRef<MapView>(null);

  const [stalls, setStalls] = useState<StallPoint[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<StallPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authService.getStalls(),
      deviceService.getCurrentLocation().catch(() => null),
    ]).then(([stallData, loc]) => {
      setStalls(stallData as StallPoint[]);
      if (loc) setUserLocation(loc);
    }).catch(() => {
      Alert.alert('Error', 'Could not load stall data.');
    }).finally(() => setIsLoading(false));
  }, []);

  const focusOnStall = (stall: StallPoint) => {
    haptics.selection();
    setSelected(stall);
    if (stall.latitude && stall.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: stall.latitude,
        longitude: stall.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
  };

  const recenter = () => {
    haptics.light();
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 600);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  const mappableStalls = stalls.filter((s) => s.latitude && s.longitude);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={PRAYAGRAJ}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {mappableStalls.map((stall) => (
          <React.Fragment key={stall.id}>
            <Marker
              coordinate={{ latitude: stall.latitude!, longitude: stall.longitude! }}
              title={stall.name}
              description={stall.address}
              pinColor={selected?.id === stall.id ? COLORS.danger : COLORS.primary}
              onPress={() => focusOnStall(stall)}
            />
            <Circle
              center={{ latitude: stall.latitude!, longitude: stall.longitude! }}
              radius={200}
              fillColor="rgba(193, 123, 47, 0.08)"
              strokeColor="rgba(193, 123, 47, 0.3)"
              strokeWidth={1}
            />
          </React.Fragment>
        ))}
      </MapView>

      {/* Re-center button */}
      {userLocation && (
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
          <Text style={styles.recenterIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Stall list at bottom */}
      <View style={styles.stallList}>
        <Text style={styles.stallListTitle}>
          {stalls.length} Stall{stalls.length !== 1 ? 's' : ''} · Civil Lines, Prayagraj
        </Text>
        {stalls.map((stall) => (
          <TouchableOpacity
            key={stall.id}
            style={[styles.stallChip, selected?.id === stall.id && styles.stallChipActive]}
            onPress={() => focusOnStall(stall)}
          >
            <Text style={[styles.stallChipText, selected?.id === stall.id && styles.stallChipTextActive]}>
              ☕ {stall.name}
            </Text>
          </TouchableOpacity>
        ))}
        {mappableStalls.length === 0 && (
          <Text style={styles.noCoords}>
            ℹ️ No GPS coordinates stored for stalls yet.{'\n'}Add latitude/longitude to stalls in the database.
          </Text>
        )}
      </View>

      {/* Selected stall card */}
      {selected && (
        <View style={styles.selectedCard}>
          <Text style={styles.selectedName}>{selected.name}</Text>
          {selected.address && <Text style={styles.selectedAddr}>📍 {selected.address}</Text>}
          {selected.latitude && (
            <Text style={styles.selectedCoords}>
              {selected.latitude.toFixed(5)}, {selected.longitude?.toFixed(5)}
            </Text>
          )}
          <TouchableOpacity style={styles.dismissBtn} onPress={() => { haptics.light(); setSelected(null); }}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },

  recenterBtn: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.full,
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.md,
  },
  recenterIcon: { fontSize: 22 },

  stallList: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
    ...SHADOWS.md, maxHeight: 180,
  },
  stallListTitle: { fontSize: FONT_SIZE.sm, color: COLORS.muted, fontWeight: '600', marginBottom: SPACING.md },
  stallChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm, marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface, display: 'flex',
  },
  stallChipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  stallChipText: { fontSize: FONT_SIZE.sm, color: COLORS.medium, fontWeight: '600' },
  stallChipTextActive: { color: COLORS.primary },
  noCoords: { fontSize: FONT_SIZE.sm, color: COLORS.muted, lineHeight: 20 },

  selectedCard: {
    position: 'absolute', top: 16, left: 16, right: 72,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    ...SHADOWS.md,
  },
  selectedName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.black },
  selectedAddr: { fontSize: FONT_SIZE.sm, color: COLORS.medium, marginTop: 2 },
  selectedCoords: { fontSize: 11, color: COLORS.muted, fontFamily: 'monospace', marginTop: 4 },
  dismissBtn: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, padding: 4 },
  dismissText: { color: COLORS.muted, fontWeight: '700' },
});

import React from 'react';
import { View, type ViewProps } from 'react-native';

type GradientWrapperProps = ViewProps & {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  children?: React.ReactNode;
};

export function GradientWrapper({ colors, style, children, ...props }: GradientWrapperProps) {
  const gradientColors = Array.from(colors);
  const fallbackColor = gradientColors[0] ?? '#000000';

  return (
    <View style={[style, { backgroundColor: fallbackColor }]} {...props}>
      {children}
    </View>
  );
}

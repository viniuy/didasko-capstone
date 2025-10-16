'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three'; // Import Three.js for Vanta.js to work
import FOG from 'vanta/dist/vanta.fog.min.js';

export default function VantaBackground() {
  const vantaRef = useRef(null);
  const [vantaEffect, setVantaEffect] = useState(null);

  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(
        FOG({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          highlightColor: 0x1010f,
          midtoneColor: 0x1794ed,
          lowlightColor: 0x16a4de,
          baseColor: 0xcdd3d9,
          blurFactor: 0.3,
          speed: 0.1,
          zoom: 0.4,
          THREE,
        }),
      );
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy(); // Cleanup
    };
  }, [vantaEffect]);

  return <div ref={vantaRef} className='absolute inset-0 z-0'></div>;
}

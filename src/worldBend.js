// World bending : courbe visuellement le monde dans le vertex shader.
// La logique du jeu reste sur une route droite.

// Uniforms partagés par tous les matériaux : modifier .value les met à jour
export const bendUniforms = {
  uBend: { value: 0 }, // courbure latérale (>0 : vers la droite, <0 : vers la gauche)
  uBendStart: { value: 8 }, // distance à la caméra en dessous de laquelle rien ne bouge
};

export function applyWorldBend(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bendUniforms.uBend;
    shader.uniforms.uBendStart = bendUniforms.uBendStart;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uBend;
        uniform float uBendStart;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelViewMatrix * mvPosition;

        float bendDist = max( 0.0, -mvPosition.z - uBendStart );
        mvPosition.x += uBend * bendDist * bendDist;

        gl_Position = projectionMatrix * mvPosition;`
      );
  };

  return material;
}

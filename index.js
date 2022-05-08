import * as THREE from 'three';
import metaversefile from 'metaversefile';

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const { useApp, useFrame } = metaversefile;

const vertexShader = `
precision mediump float;
precision mediump int;
attribute vec4 color;

uniform float height;
uniform float blend;
uniform sampler2D gradient;
uniform sampler2D blendPattern;

varying vec2 vUv;
varying float vFade;
varying float dissolve;
void main() {
    mat4 model = instanceMatrix;
    vUv = ((uv + model[3].xy -1.) * 1.4) / height;
    dissolve = texture2D(blendPattern, vUv/height).r;
    vec4 localPosition = vec4( dissolve*0.1+position, 1) ;
    
    vFade = clamp((position.y + 3.0) / 6.0, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * localPosition;
}
`;

const fragmentShader = `
precision mediump float;
precision mediump int;

uniform float time;
uniform float blend;

uniform sampler2D gradient;
uniform sampler2D blendPattern;

varying float vFade;
varying vec2 vUv;
varying float dissolve;

void main() {
float spread = 0.2;
    float fadeAmount = smoothstep(
        max(0., vFade - spread),
        min(1., vFade + spread),
        blend + dissolve*1.2
    );
    gl_FragColor = texture2D(gradient, vUv*fadeAmount);
}
`;

class Fire extends THREE.Object3D {
  constructor({
    density = 30, 
    height = 5, 
    r = 1, 
    resolution = 2,
    dissolveImage = 'https://mwmwmw.github.io/files/Textures/Tendrils.png',
    fireImage = 'https://mwmwmw.github.io/files/Textures/Fire2.png',
  }) {
    super();
    this.height = height;
    this.radius = r;
    this.density = density;
    this.instanceData = new Array(density);

    var texture = new THREE.TextureLoader().load(
      dissolveImage,
      function() {
        console.log('loaded');
      },
      undefined,
      function(e) {
        console.log('error', e);
      },
    );
    texture.crossOrigin = ''; // "anonymous";
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    var fireGradient = new THREE.TextureLoader().load(
      fireImage,
      function() {
        console.log('loaded');
      },
      undefined,
      function(e) {
        console.log('error', e);
      },
    );
    fireGradient.crossOrigin = ''; // "anonymous";
    fireGradient.wrapS = THREE.RepeatWrapping;

    this.fireMaterial = new THREE.ShaderMaterial({
      uniforms: {
        height: {value: height},
        blend: {value: 1.0},
        gradient: {type: 't', value: fireGradient},
        blendPattern: {type: 't', value: texture},
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      // side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.light = new THREE.PointLight(0xff5500, 1, 100);
    this.light.position.set(0, 0.4, 0);
    this.lightIntensity = Math.random() * 5;

    this.add(this.light);

    this.bufferGeometry = new THREE.IcosahedronBufferGeometry(
      1,
      resolution,
      resolution,
    );

    this.mesh = new THREE.InstancedMesh(
      this.bufferGeometry,
      this.fireMaterial,
      density,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.iMatrix = new THREE.Matrix4();
    this.iPosition = new THREE.Vector3(0, 0, 0);
    this.iScale = new THREE.Vector3();
    this.iRotation = new THREE.Quaternion();
    this.iEuler = new THREE.Euler(0, 0, 0);

    for (var i = 0; i < this.density; i++) {
      this.mesh.getMatrixAt(i, this.iMatrix);
      this.iMatrix.decompose(this.iPosition, this.iRotation, this.iScale);

      this.instanceData[i] = this.randomInstanceData();

      this.iPosition.set(
        (0.5 - Math.random()) * this.radius,
        Math.random() * this.height,
        (0.5 - Math.random()) * this.radius,
      );

      this.iRotation.copy(this.instanceData[i].r);
      this.iScale.x = this.iScale.y = this.iScale.z = this.instanceData[i].s;

      this.iMatrix.compose(this.iPosition, this.iRotation, this.iScale);
      this.mesh.setMatrixAt(i, this.iMatrix);
    }

    this.mesh.position.y -= 0.75;
    this.add(this.mesh);
  }

  randomInstanceData() {
    this.iEuler.set(
      (0.5 - Math.random()) * 0.001,
      (0.5 - Math.random()) * 0.003,
      (0.5 - Math.random()) * 0.001,
    );
    return {
      dirX: (0.5 - Math.random()) * 1,
      dirY: 0.01 + Math.random() * 0.03,
      dirZ: (0.5 - Math.random()) * 1,
      r: new THREE.Quaternion().setFromEuler(this.iEuler),
      s: 0.2 + this.iPosition.y * Math.random(),
    };
  }

  update() {
    for (var i = 0; i < this.density; i++) {
      const ball = this.instanceData[i];
      this.mesh.getMatrixAt(i, this.iMatrix);
      this.iMatrix.decompose(this.iPosition, this.iRotation, this.iScale);

      this.iPosition.x = Math.sin(this.iPosition.y * 0.5) * ball.dirX;
      this.iPosition.y += ball.dirY + Math.sin(this.iPosition.y * 0.002);
      this.iPosition.z = Math.cos(this.iPosition.y * 0.25) * ball.dirZ;
      // return;
      this.iScale.x = this.iScale.y = this.iScale.z =
				ball.s +
				Math.pow(Math.max(0.2, Math.max(1, this.iPosition.y) / this.height), 2);

      if (this.iPosition.y > this.height) {
        this.iPosition.y = 0;
        this.iScale.x = this.iScale.y = this.iScale.z = 0.1;
        this.instanceData[i] = this.randomInstanceData();
      }

      // return;
      this.iRotation.normalize();
      this.iRotation.multiply(ball.r);

      this.iMatrix.compose(this.iPosition, this.iRotation, this.iScale);
      this.mesh.setMatrixAt(i, this.iMatrix);
    }
    // console.log(this.iMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;

    this.light.intensity += (this.lightIntensity - this.light.intensity) * 0.02;

    if (Math.random() > 0.8) {
      this.lightIntensity = Math.random() * 5;
    }
  }

  env(val, envelope = [0, 0, 0.1, 1, 1, 0]) {
    function lerp(v0, v1, t) {
      return v0 * (1 - t) + v1 * t;
    }
  }
}



export default () => {
  const app = useApp();

  const fire = new Fire({
    density: 100,
    fireImage: `${baseUrl}/textures/fire.png`,
    dissolveImage: `${baseUrl}/textures/dissolve.png`
  });

  useFrame(() => {
    fire.update();
  });

  app.add(fire);

  return app;
};

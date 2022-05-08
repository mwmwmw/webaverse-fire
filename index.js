import metaversefile from 'metaversefile';
import Fire from './fire';
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const {useApp, useFrame } = metaversefile;

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

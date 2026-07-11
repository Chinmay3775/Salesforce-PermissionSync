import { RouterProvider } from 'react-router-dom';
import router from './routes';
import { useUIStore } from './store';
import { useEffect } from 'react';

function App() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return <RouterProvider router={router} />;
}

export default App;

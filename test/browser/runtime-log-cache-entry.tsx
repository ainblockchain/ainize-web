import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ThemeProvider} from 'styled-components';
import {store} from '../../src/store';
import {AuthProvider} from '../../src/auth/AuthContext';
import {theme} from '../../src/theme/theme';
import {RuntimeLogView} from '../../src/screens/ProjectPage';
function App(){const [id,setId]=useState('one');Object.assign(window,{switchProject:setId});return <RuntimeLogView project={{id,org:'team',repoName:id,canOperate:true} as any}/>;}
createRoot(document.getElementById('root')!).render(<Provider store={store}><ThemeProvider theme={theme}><AuthProvider><App/></AuthProvider></ThemeProvider></Provider>);

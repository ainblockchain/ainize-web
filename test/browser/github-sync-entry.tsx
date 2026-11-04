import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ThemeProvider} from 'styled-components';
import {store} from '../../src/store';
import {api} from '../../src/api/api';
import {AuthProvider} from '../../src/auth/AuthContext';
import {theme} from '../../src/theme/theme';
import ProjectGithubSync from '../../src/components/ProjectGithubSync';
function App(){const [id,setId]=useState('one');Object.assign(window,{switchProject:setId,refresh:()=>store.dispatch(api.endpoints.projectGithubSync.initiate(id,{forceRefetch:true,subscribe:false})).unwrap()});return <ProjectGithubSync project={{id,canOperate:true,upstreamRepo:'https://github.com/team/managed'} as any}/>;}
createRoot(document.getElementById('root')!).render(<Provider store={store}><ThemeProvider theme={theme}><AuthProvider><App/></AuthProvider></ThemeProvider></Provider>);

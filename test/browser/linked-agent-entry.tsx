import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter,Routes,Route,useNavigate,useLocation} from 'react-router';
import {ThemeProvider} from 'styled-components';
import {store} from '../../src/store';
import {api} from '../../src/api/api';
import {AuthProvider} from '../../src/auth/AuthContext';
import {theme} from '../../src/theme/theme';
import AgentLinkPage from '../../src/screens/AgentLinkPage';

function App(){
  const navigate=useNavigate();const location=useLocation();
  Object.assign(window,{navigate,refresh:(id:string)=>store.dispatch(api.util.invalidateTags([{type:'LinkedAgent',id}]))});
  return <><output data-testid="location">{location.pathname}</output><Routes>
    <Route path="/agent/:id/link" element={<AgentLinkPage/>}/>
    <Route path="/agent/link" element={<AgentLinkPage/>}/>
    <Route path="*" element={<p>Saved</p>}/>
  </Routes></>;
}
createRoot(document.getElementById('root')!).render(<Provider store={store}><ThemeProvider theme={theme}><AuthProvider><BrowserRouter><App/></BrowserRouter></AuthProvider></ThemeProvider></Provider>);

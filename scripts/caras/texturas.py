# Genera texturas (frente | espalda) y perfiles de silueta de cabeza y torso a partir de las capturas de Meshy.
from PIL import Image
import numpy as np, json
from scipy import ndimage
IMG='/tmp/claude-0/-home-user/d1e4e6e0-3eb5-5501-bf7b-5a0cb0fd3a22/images/'
OUT='/home/user/ChessORT/shared/public/caras/'
ALTO=1.85  # metros
C={
 'mati':   dict(f='28.png',box=None,menton=200,cinto=None, pelo=(0,.78,'pelo'), torso=False),
 'glinsky':dict(f='24.webp',box=(690,280,1110,860),menton=195,cinto=372,pelo=(0,.8,'pelo'), torso=True),
 'julo':   dict(f='30.png',box=None,menton=170,cinto=None,pelo=None, torso=False),
 'dobro':  dict(croma=True,f='31.png',box=None,menton=201,cinto=392,pelo=(0,.8,'pelo'), torso=True),
 'faur':   dict(f='32.png',box=None,menton=238,cinto=400,pelo=(.32,.82,'fleco'), torso=True),
}
def cargar(c):
    p=Image.open(IMG+c['f']).convert('RGB')
    if c['box']: p=p.crop(c['box'])
    return p
def mascara(im, croma=False):
    h,w,_=im.shape; m=np.zeros((h,w),bool)
    for y in range(h):
        bg=(im[y,:6].mean(0)+im[y,-6:].mean(0))/2
        m[y]=(np.abs(im[y]-bg).sum(1)>38)|(croma & ((im[y,:,2]-im[y,:,0])<=2))
    m=ndimage.binary_opening(m,iterations=1); m=ndimage.binary_fill_holes(m)
    return m
def corrida(fila, cx):
    # tramo continuo de la máscara que contiene (o está más cerca de) cx
    xs=np.where(fila)[0]
    if not len(xs): return None
    lab,n=ndimage.label(fila)
    if fila[cx]: l=lab[cx]
    else: l=lab[xs[np.argmin(np.abs(xs-cx))]]
    q=np.where(lab==l)[0]; return int(q.min()),int(q.max())
def rellenar(arr, m):
    # cada pixel fuera de la máscara toma el color del pixel de la máscara más cercano
    idx=ndimage.distance_transform_edt(~m,return_distances=False,return_indices=True)
    return arr[idx[0],idx[1]]
def envolvente(m,y0,y1):
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    ys,xs=np.where(m[y0:y1+1]); pts=np.c_[xs,ys+y0]
    h=ConvexHull(pts); poly=[tuple(map(float,pts[i])) for i in h.vertices]
    img=Image.new('L',(m.shape[1],m.shape[0]),0); ImageDraw.Draw(img).polygon(poly,fill=1)
    e=np.asarray(img).astype(bool); out=m.copy(); out[y0:y1+1]=e[y0:y1+1]; return out
def parte(im,m,y0,y1,cx,filas,escala,minimo=3,mtex=None,limitar=False):
    perfil=[]; xl=[];xr=[]
    for y in range(y0,y1+1):
        r=corrida(m[y],cx)
        if r is None or r[1]-r[0]<minimo: r=(cx-1,cx+1)
        xl.append(r[0]); xr.append(r[1])
    xl=np.array(xl); xr=np.array(xr)
    if limitar:
        # abajo del pecho, que las manos o los puños pegados no ensanchen el torso
        n=len(xl); mid=slice(int(n*.35),int(n*.6)); hw=np.median((xr-xl)[mid])/2*1.06
        for i in range(int(n*.5),n):
            xl[i]=max(xl[i],cx-hw); xr[i]=min(xr[i],cx+hw)
    # suavizar un poco el contorno
    xl=ndimage.uniform_filter1d(xl.astype(float),3); xr=ndimage.uniform_filter1d(xr.astype(float),3)
    X0=int(np.floor(xl.min())); X1=int(np.ceil(xr.max()))
    for i in range(filas+1):
        t=i/filas; j=min(len(xl)-1,int(round(t*(len(xl)-1))))
        perfil.append([round(t*(y1-y0)*escala,4), round((xl[j]-cx)*escala,4), round((xr[j]+1-cx)*escala,4)])
    rec=im[y0:y1+1,X0:X1+1].copy(); mm=np.zeros(rec.shape[:2],bool)
    for k,y in enumerate(range(y0,y1+1)):
        a=int(round(xl[k]))-X0; b=int(round(xr[k]))-X0
        mm[k,max(0,a):b+1]=(mtex if mtex is not None else m)[y,X0+max(0,a):X0+b+1]
    rec=rellenar(rec,mm)
    return rec, perfil, dict(x0=round((X0-cx)*escala,4), x1=round((X1+1-cx)*escala,4), alto=round((y1-y0+1)*escala,4))
def mediana(im,m,y0,y1,x0,x1):
    reg=im[y0:y1,x0:x1].reshape(-1,3); mk=m[y0:y1,x0:x1].reshape(-1)
    reg=reg[mk] if mk.any() else reg
    return '#%02x%02x%02x'%tuple(int(v) for v in np.median(reg,0))
def atlas(frente, espalda, ancho=256):
    h=int(round(frente.shape[0]*ancho/frente.shape[1]))
    a=Image.new('RGB',(ancho*2,h))
    a.paste(Image.fromarray(frente.astype('uint8')).resize((ancho,h),Image.LANCZOS),(0,0))
    a.paste(Image.fromarray(espalda.astype('uint8')).resize((ancho,h),Image.LANCZOS),(ancho,0))
    return a
datos={}
for k,c in C.items():
    p=cargar(c); im=np.asarray(p).astype(int); m=mascara(im); mt=mascara(im, c.get('croma',False))
    if c.get('croma'): mt[:c['menton']+22]=m[:c['menton']+22]  # cuello y hombros: sin la regla de tono (confunde el fondo)
    rows=np.where(m.sum(1)>3)[0]; top,bot=int(rows[0]),int(rows[-1])
    esc=ALTO/(bot-top)
    # eje: centro del cuello
    cy=c['menton']+4; r=corrida(m[cy], int(np.where(m[cy])[0].mean())); cx=(r[0]+r[1])//2
    # eje de la cabeza: el centro de su propia silueta (en la carrera la cabeza no está sobre el cuello)
    mids=[sum(corrida(m[y],cx))/2 for y in range(top+int((c['menton']-top)*.3),c['menton']-int((c['menton']-top)*.15)) if corrida(m[y],cx)]
    hx=int(round(np.median(mids)))
    mh=envolvente(m,top,c['menton'])
    X0c=int(np.floor(min(corrida(mh[y],hx)[0] for y in range(top,c['menton']+1) if corrida(mh[y],hx))))
    cab,perf,dim=parte(im,mh,top,c['menton'],hx,16,esc,mtex=m)
    piel=mediana(im,m,top+int((c['menton']-top)*.45),top+int((c['menton']-top)*.55),hx-4,hx+4)
    # color de pelo: franja de arriba al centro
    pelo=mediana(im,m,top+2,top+int((c['menton']-top)*.12),hx-6,hx+6)
    esp=np.zeros_like(cab); H=cab.shape[0]
    esp[:]=np.array([int(piel[i:i+2],16) for i in (1,3,5)])
    if c['pelo']:
        a,b,modo=c['pelo']; col=np.array([int(pelo[i:i+2],16) for i in (1,3,5)])
        if modo=='fleco': col=np.array([0x3a,0x2c,0x24])
        esp[int(a*H):int(b*H)]=col
        # transición suave hacia la nuca
        for i in range(int(b*H),min(H,int(b*H)+6)): t=(i-int(b*H))/6; esp[i]=col*(1-t)+esp[i]*t
    # costados: la espalda arranca con el color del borde de la cara (oreja/pelo) y va hacia el color de atrás
    Wc=cab.shape[1]; esp=esp.astype(float)
    def borde(fila, lado):
        xs=np.where(mh[top+fila, :])[0] if top+fila < mh.shape[0] else []
        return None
    for i in range(H):
        y=top+i; r=corrida(mh[y],hx)
        if r is None: continue
        a=max(0,r[0]-X0c+2); b=min(Wc-1,r[1]-X0c-2)
        if b<=a: continue
        Lc=cab[i,a:a+3].mean(0); Rc=cab[i,b-2:b+1].mean(0)
        for j in range(Wc):
            t=j/(Wc-1)  # 0 = borde derecho de la cara, 1 = borde izquierdo (espalda espejada)
            k1=max(0,1-t/.3); k2=max(0,(t-.7)/.3)
            esp[i,j]=esp[i,j]*(1-k1-k2)+Rc*k1+Lc*k2
    atlas(cab,esp).save(OUT+f'{k}-cabeza.webp',quality=90)
    d=dict(cabeza=dict(perfil=perf,**dim),piel=piel,pelo=pelo,
           cabezaAlto=round((c['menton']-top)*esc,4))
    if c['torso'] and c['cinto']:
        tor,perft,dimt=parte(im,mt,c['menton']+3,c['cinto'],cx,10,esc,limitar=True)
        # espalda: color del costado del torso (la prenda de afuera)
        lado=mediana(im,m,c['menton']+int((c['cinto']-c['menton'])*.55),c['menton']+int((c['cinto']-c['menton'])*.7),int(cx-(dimt['x1']-dimt['x0'])/esc*.38),int(cx-(dimt['x1']-dimt['x0'])/esc*.3))
        esp=np.zeros_like(tor); esp[:]=np.array([int(lado[i:i+2],16) for i in (1,3,5)])
        atlas(tor,esp).save(OUT+f'{k}-torso.webp',quality=90)
        d['torso']=dict(perfil=perft,**dimt); d['prenda']=lado
    datos[k]=d
    print(k,'piel',piel,'pelo',pelo,'cabeza',dim, 'torso' in d and d['prenda'])
json.dump(datos,open('perfiles.json','w'))

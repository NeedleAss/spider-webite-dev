"""Loopback-only video fault fixture. Never a robot or a camera proxy."""
import asyncio,io
from aiohttp import web
from PIL import Image,ImageDraw
async def stream(request):
    scenario=request.query.get('scenario','live')
    headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8765','Cache-Control':'no-store'}
    if scenario=='busy':return web.Response(status=503,text='Viewer occupied',headers=headers)
    headers['Content-Type']='multipart/x-mixed-replace; boundary=camera'
    response=web.StreamResponse(headers=headers);await response.prepare(request)
    n=0
    try:
        while True:
            if scenario=='freeze' and n>=3:await asyncio.sleep(.1);continue
            image=Image.new('RGB',(320,240),'#3c505c');d=ImageDraw.Draw(image);d.text((20,20),'V6 LOOPBACK FIXTURE',fill='white');d.text((20,45),str(n),fill='white');d.rectangle((90+n%50,70,150+n%50,170),fill='#b9cccf')
            out=io.BytesIO();image.save(out,format='JPEG');data=out.getvalue()
            await response.write(b'--camera\r\nContent-Type: image/jpeg\r\nContent-Length: '+str(len(data)).encode()+b'\r\n\r\n'+data+b'\r\n')
            n+=1;await asyncio.sleep(.1)
    except (ConnectionError,asyncio.CancelledError):pass
    return response
app=web.Application();app.router.add_get('/stream',stream)
if __name__=='__main__':web.run_app(app,host='127.0.0.1',port=8767,shutdown_timeout=1)

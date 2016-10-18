from channels.routing import route, include

channel_routing = [
    include('cq.routing.channel_routing')
]
